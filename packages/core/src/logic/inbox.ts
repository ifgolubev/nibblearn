import type { InboxAction, InboxMessage } from "../schema/modules/inbox-triage";

/** Outcome of one triage decision. */
export type TriageStatus = "correct" | "acceptable" | "wrong" | "pending";

/** Message id → chosen action id. */
export type TriageDecisions = Record<string, string | undefined>;

type ActionLike = Pick<InboxAction, "id"> & { icon?: InboxAction["icon"] };
type MessageLike = Pick<InboxMessage, "id" | "correctAction"> & {
  flags?: readonly InboxMessage["flags"][number][];
  acceptable?: readonly string[];
};

/** Anything shaped like an inbox-triage config (parsed or input form). */
export interface TriageConfigLike {
  content: { actions: readonly ActionLike[]; messages: readonly MessageLike[] };
}

export interface TriageMessageResult {
  id: string;
  /** The learner's action id, if any. */
  decision?: string;
  correctAction: string;
  status: TriageStatus;
  /** 1 correct, 0.5 acceptable, 0 wrong or pending. */
  points: number;
  /** Needed attention first: VIP sender, a security threat, or an expert "reply now"/"report" call. */
  priority: boolean;
}

export interface TriageEvaluation {
  messages: TriageMessageResult[];
  /** Sum of points. */
  points: number;
  /** Number of messages. */
  total: number;
  /** points ÷ total, 0–1. */
  score: number;
  handled: number;
  correct: number;
  acceptable: number;
  wrong: number;
  pending: number;
  /** Action id → how many messages the learner sent there. */
  actionCounts: Record<string, number>;
  /** Action id → how many messages the expert sends there. */
  expertCounts: Record<string, number>;
  /** Ids of priority messages that got a wrong call, in message order. */
  missedPriority: string[];
}

/** Points for each status. */
export const TRIAGE_POINTS: Record<TriageStatus, number> = {
  correct: 1,
  acceptable: 0.5,
  wrong: 0,
  pending: 0,
};

/** Grade one decision. `undefined` means the message has not been handled yet. */
export function gradeTriageDecision(
  message: MessageLike,
  actionId: string | undefined,
): { status: TriageStatus; points: number } {
  let status: TriageStatus;
  if (actionId === undefined) status = "pending";
  else if (actionId === message.correctAction) status = "correct";
  else if ((message.acceptable ?? []).includes(actionId)) status = "acceptable";
  else status = "wrong";
  return { status, points: TRIAGE_POINTS[status] };
}

/**
 * A message needs attention first when it comes from a VIP, carries a suspicious link, or the
 * expert call is an urgent action (an action with the "reply" or "alert" icon).
 */
export function isPriorityMessage(message: MessageLike, actions: readonly ActionLike[]): boolean {
  const flags = message.flags ?? [];
  if (flags.includes("vip") || flags.includes("suspicious-link")) return true;
  const icon = actions.find((a) => a.id === message.correctAction)?.icon;
  return icon === "reply" || icon === "alert";
}

/** Score every message, count decisions per action and list the priority messages that were missed. */
export function evaluateTriage(
  config: TriageConfigLike,
  decisions: TriageDecisions,
): TriageEvaluation {
  const { actions, messages } = config.content;
  const known = new Set(actions.map((a) => a.id));
  const actionCounts: Record<string, number> = Object.fromEntries(actions.map((a) => [a.id, 0]));
  const expertCounts: Record<string, number> = Object.fromEntries(actions.map((a) => [a.id, 0]));

  const results = messages.map((m): TriageMessageResult => {
    const raw = decisions[m.id];
    // Decisions for actions that do not exist count as wrong, not as pending.
    const { status, points } = gradeTriageDecision(m, raw);
    if (raw !== undefined && known.has(raw)) actionCounts[raw] = (actionCounts[raw] ?? 0) + 1;
    if (known.has(m.correctAction)) expertCounts[m.correctAction]! += 1;
    return {
      id: m.id,
      ...(raw !== undefined ? { decision: raw } : {}),
      correctAction: m.correctAction,
      status,
      points,
      priority: isPriorityMessage(m, actions),
    };
  });

  const count = (s: TriageStatus) => results.filter((r) => r.status === s).length;
  const points = results.reduce((sum, r) => sum + r.points, 0);
  const total = results.length;
  return {
    messages: results,
    points,
    total,
    score: total > 0 ? points / total : 0,
    handled: total - count("pending"),
    correct: count("correct"),
    acceptable: count("acceptable"),
    wrong: count("wrong"),
    pending: count("pending"),
    actionCounts,
    expertCounts,
    missedPriority: results.filter((r) => r.priority && r.status === "wrong").map((r) => r.id),
  };
}

/**
 * Index of the next unhandled message after `from`, wrapping around to the start.
 * Returns -1 when every message has been handled.
 */
export function nextUnhandledIndex(
  messages: readonly Pick<InboxMessage, "id">[],
  decisions: TriageDecisions,
  from: number,
): number {
  const n = messages.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + step) % n) + n) % n;
    if (decisions[messages[i]!.id] === undefined) return i;
  }
  return -1;
}
