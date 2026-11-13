import type { ConversationConfig, ConversationNode } from "../schema/modules/conversation";

export interface ConversationTurn {
  node: ConversationNode;
  /** True when the node has no responses. */
  done: boolean;
}

/**
 * A provider decides what happens next in a conversation. The default scripted
 * provider follows the JSON graph deterministically. An AI-backed provider could
 * implement the same interface; Nibblearn never ships or requires one.
 */
export interface ConversationProvider {
  start(): Promise<ConversationTurn> | ConversationTurn;
  respond(responseId: string): Promise<ConversationTurn> | ConversationTurn;
  /** Optional free-text support. Scripted provider does not implement it. */
  respondFreeText?(text: string): Promise<ConversationTurn>;
}

export interface ScriptedResponse {
  id: string;
  text: string;
  next: string;
  tone?: string;
  effectiveness: number;
  feedback?: string;
}

/** Resolve response ids (fallback: `${nodeId}-r${index}`). */
export function responsesOf(node: ConversationNode): ScriptedResponse[] {
  return node.responses.map((r, i) => ({ ...r, id: r.id ?? `${node.id}-r${i}` }));
}

export function createScriptedProvider(config: ConversationConfig): ConversationProvider {
  const nodes = new Map(config.content.nodes.map((n) => [n.id, n]));
  let currentId = config.content.start;
  let steps = 0;
  const turn = (id: string): ConversationTurn => {
    const node = nodes.get(id);
    if (!node) throw new Error(`conversation node "${id}" not found`);
    return { node, done: node.responses.length === 0 || steps >= config.behavior.maxSteps };
  };
  return {
    start() {
      currentId = config.content.start;
      steps = 0;
      return turn(currentId);
    },
    respond(responseId) {
      const node = nodes.get(currentId);
      const response = node ? responsesOf(node).find((r) => r.id === responseId) : undefined;
      if (!response)
        throw new Error(`response "${responseId}" not available on node "${currentId}"`);
      currentId = response.next;
      steps++;
      return turn(currentId);
    },
  };
}

/** Default typing delay for a message, scaled by length. */
export function typingDelay(text: string, override?: number): number {
  if (typeof override === "number") return override;
  return Math.min(2200, 500 + text.length * 18);
}

export interface ConversationSummary {
  /** Average effectiveness of chosen responses (0–1). */
  score: number;
  tones: string[];
  outcome: "success" | "neutral" | "failure";
}

export function summarizeConversation(
  chosen: readonly ScriptedResponse[],
  ending: ConversationNode | undefined,
): ConversationSummary {
  const score = chosen.length ? chosen.reduce((s, r) => s + r.effectiveness, 0) / chosen.length : 1;
  const tones = [...new Set(chosen.map((r) => r.tone).filter((t): t is string => Boolean(t)))];
  const outcome =
    ending?.outcome ?? (score >= 0.7 ? "success" : score >= 0.4 ? "neutral" : "failure");
  return { score, tones, outcome };
}
