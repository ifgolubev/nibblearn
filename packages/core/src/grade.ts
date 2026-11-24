import { z } from "zod";
import {
  allocationBounds,
  allocationGoalProgress,
  allocationScore,
  evaluateAllocation,
  optimalAllocation,
} from "./logic/budget";
import { evaluateCategorySort } from "./logic/category-sort";
import { evaluateChoice, withOptionIds } from "./logic/choice";
import { responsesOf, summarizeConversation, type ScriptedResponse } from "./logic/conversation";
import { estimateAccuracy } from "./logic/estimate";
import { evaluateFillBlanks } from "./logic/fill-blanks";
import { evaluateTriage, type TriageDecisions } from "./logic/inbox";
import { evaluatePriorityMatrix } from "./logic/priority-matrix";
import { chooseScenario, scenarioScore, startScenario } from "./logic/scenario";
import { attemptScore, findAllScore, matchingScore } from "./logic/scoring";
import { evaluateSequence } from "./logic/sequence";
import { evaluateWordOrder, scoreWordItem } from "./logic/word-builder";
import type {
  BranchingScenarioConfig,
  BudgetAllocatorConfig,
  CategorySortConfig,
  ChoiceChallengeConfig,
  ConversationConfig,
  EstimateConfig,
  FillBlanksConfig,
  InboxTriageConfig,
  LabelDiagramConfig,
  MatchPairsConfig,
  PriorityMatrixConfig,
  SequenceBuilderConfig,
  SpotTheMistakeConfig,
  TrueFalseConfig,
  WordBuilderConfig,
} from "./schema/modules";
import type { SchemaRegistry } from "./schema/registry";
import { modulePassThreshold } from "./progress";
import { issuesFromZod, validateModule, type ValidationIssue } from "./validate";

/** One thing the learner submitted: a check, a choice, a decision. */
export interface ModuleAnswer {
  /** Id of the answered item, when items have ids. */
  itemId?: string;
  /** Index of the answered item, when the module is item based. */
  itemIndex?: number;
  /** What the learner submitted. Its shape depends on the module type. */
  response?: unknown;
}

/**
 * Everything the learner submitted in one run of a module, in order, without any verdict.
 * Components report it as `ModuleResult.response`; `gradeModule()` scores it.
 */
export interface ModuleResponse {
  answers: ModuleAnswer[];
}

/** Most answers one run may hold; later answers are not recorded. */
export const MAX_RESPONSE_ANSWERS = 2000;

/** Shape check for a `ModuleResponse` that comes from outside (a browser, a queue). */
export const moduleResponseSchema = z.object({
  answers: z
    .array(
      z.object({
        itemId: z.string().max(200).optional(),
        itemIndex: z.number().int().min(0).max(100_000).optional(),
        response: z.unknown().optional(),
      }),
    )
    .max(MAX_RESPONSE_ANSWERS),
});

/** Verdict for one item (question, blank, message…) of a graded module. */
export interface GradedItem {
  id?: string;
  index?: number;
  correct: boolean;
  /** 0–1 credit for this item. */
  score: number;
  /** How many times the learner submitted this item. 0 when it was left unanswered. */
  attempts: number;
  /** The learner's last submission for the item. */
  response?: unknown;
  /** The expected answer. Do not send it to the learner before they have answered. */
  expected?: unknown;
}

export interface ModuleGrade {
  moduleId: string;
  moduleType: string;
  /**
   * 0–1. Always 0 while `complete` is false: an activity that was not finished has no result
   * yet, whatever its answers so far would be worth. Undefined when the config asks for no
   * score (e.g. a scenario with `showScore: false`).
   */
  score?: number;
  /** Number of items answered correctly, for item based modules. */
  correct?: number;
  /** Number of scorable items, for item based modules. */
  total?: number;
  /**
   * `score` reaches the module's pass threshold (`modulePassThreshold()`: `scoring.passThreshold`,
   * or 0.7 when it is 0 or not set). Unscored modules pass when they are complete.
   */
  passed: boolean;
  /** False when the response leaves part of the module unanswered (those parts score 0). */
  complete: boolean;
  /** Number of submissions the score is based on. */
  attempts: number;
  items: GradedItem[];
}

export type GradeResult =
  | { success: true; grade: ModuleGrade; issues: [] }
  | {
      success: false;
      grade?: undefined;
      /**
       * "invalid-config": the config failed validation. "not-gradable": the module type has no
       * answers to grade. "invalid-response": the response does not fit the config.
       */
      reason: "invalid-config" | "not-gradable" | "invalid-response";
      issues: ValidationIssue[];
    };

type Graded = Omit<ModuleGrade, "moduleId" | "moduleType" | "passed">;

/** Grades a parsed config of one module type. Throw `ResponseError` for an unusable response. */
export type ModuleGrader = (config: never, answers: readonly ModuleAnswer[]) => Graded;

export interface GradeOptions {
  /** Registry used to validate the config. Defaults to the built-in modules. */
  registry?: SchemaRegistry;
  /** Graders for custom module types (or replacements for built-in ones), keyed by type. */
  graders?: Readonly<Record<string, ModuleGrader>>;
}

/** Thrown by a grader when the response cannot belong to the config. */
export class ResponseError extends Error {
  constructor(
    message: string,
    readonly answerIndex?: number,
  ) {
    super(message);
    this.name = "ResponseError";
  }
}

// ---- helpers ----------------------------------------------------------------------------------

const hasOwn = (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k);

function bad(message: string, answerIndex?: number): never {
  throw new ResponseError(message, answerIndex);
}

function stringList(value: unknown, at: number, max = 500): string[] {
  if (!Array.isArray(value) || value.length > max) bad("expected a list of strings", at);
  const list = value as unknown[];
  for (const v of list)
    if (typeof v !== "string" || v.length > 2000) bad("expected a list of strings", at);
  return list as string[];
}

function plainRecord(value: unknown, at: number): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    bad("expected an object", at);
  return value as Record<string, unknown>;
}

/** `record[id]` for the given ids only, as strings; anything else is treated as unanswered. */
function pickStrings(
  value: unknown,
  ids: readonly string[],
  at: number,
): Record<string, string | undefined> {
  const record = plainRecord(value, at);
  const out: Record<string, string | undefined> = {};
  for (const id of ids) {
    const v = hasOwn(record, id) ? record[id] : undefined;
    if (v !== undefined && v !== null && typeof v !== "string")
      bad(`expected text for "${id}"`, at);
    out[id] = typeof v === "string" && v.length <= 2000 ? v : undefined;
  }
  return out;
}

/** Full credit on the first submission, −0.25 per extra one, never below 0.5. */
const retryCredit = (attempts: number) =>
  attempts <= 1 ? 1 : Math.max(0.5, 1 - 0.25 * (attempts - 1));

const round4 = (n: number) => Number(n.toFixed(4));

const mean = (scores: readonly number[]) =>
  scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : 0;

/** Answers grouped by `itemIndex`, with their position in the response. */
function byIndex(answers: readonly ModuleAnswer[], count: number) {
  const groups: { answer: ModuleAnswer; at: number }[][] = Array.from({ length: count }, () => []);
  answers.forEach((answer, at) => {
    const i = answer.itemIndex;
    if (i === undefined || i >= count) bad("answer refers to an item that does not exist", at);
    groups[i]!.push({ answer, at });
  });
  return groups;
}

/** Shared shape for modules made of independent items. */
function fromItems(items: GradedItem[], attempts: number): Graded {
  return {
    score: mean(items.map((i) => i.score)),
    correct: items.filter((i) => i.correct).length,
    total: items.length,
    complete: items.every((i) => i.attempts > 0),
    attempts,
    items,
  };
}

const unanswered: Graded = { score: 0, complete: false, attempts: 0, items: [] };

// ---- graders ----------------------------------------------------------------------------------

function gradeChoice(config: ChoiceChallengeConfig, answers: readonly ModuleAnswer[]): Graded {
  const { questions } = config.content;
  // Answers collected for the host are submitted once; changing one is not a retry.
  const external = config.behavior.evaluation === "external";
  const items = byIndex(answers, questions.length).map((group, index): GradedItem => {
    const options = withOptionIds(questions[index]!, index);
    const expected = options.filter((o) => o.correct).map((o) => o.id);
    const last = group[group.length - 1];
    if (!last) return { index, correct: false, score: 0, attempts: 0, expected };
    const selected = stringList(last.answer.response, last.at);
    const known = new Set(options.map((o) => o.id));
    if (selected.some((id) => !known.has(id))) bad("unknown option", last.at);
    const ev = evaluateChoice(options, selected, { partialCredit: config.behavior.partialCredit });
    const attempts = external ? 1 : group.length;
    return {
      index,
      correct: ev.correct,
      score: ev.correct ? retryCredit(attempts) : ev.score,
      attempts,
      response: selected,
      expected,
    };
  });
  return fromItems(items, answers.length);
}

function gradeTrueFalse(config: TrueFalseConfig, answers: readonly ModuleAnswer[]): Graded {
  const { statements } = config.content;
  const items = byIndex(answers, statements.length).map((group, index): GradedItem => {
    const expected = statements[index]!.isTrue;
    // A statement is answered once: the first answer counts.
    const first = group[0];
    if (!first) return { index, correct: false, score: 0, attempts: 0, expected };
    if (typeof first.answer.response !== "boolean") bad("expected true or false", first.at);
    const correct = first.answer.response === expected;
    return {
      index,
      correct,
      score: correct ? 1 : 0,
      attempts: 1,
      response: first.answer.response,
      expected,
    };
  });
  return fromItems(items, answers.length);
}

function gradeSequence(config: SequenceBuilderConfig, answers: readonly ModuleAnswer[]): Graded {
  const expected = config.content.items.map((i) => i.id);
  if (answers.length === 0) return { ...unanswered, total: expected.length, correct: 0 };
  const at = answers.length - 1;
  const order = stringList(answers[at]!.response, at);
  if (order.length !== expected.length || new Set(order).size !== order.length)
    bad("the order must list every item once", at);
  if (order.some((id) => !expected.includes(id))) bad("unknown item", at);
  const ev = evaluateSequence(expected, order);
  return {
    // Not solved: the learner was shown the answer, which halves what they had right.
    score: ev.correct ? retryCredit(answers.length) : ev.score * 0.5,
    correct: ev.correctCount,
    total: expected.length,
    complete: true,
    attempts: answers.length,
    items: order.map((id, index) => ({
      id,
      index,
      correct: ev.positions[index] === true,
      score: ev.positions[index] ? 1 : 0,
      attempts: answers.length,
      expected: expected[index],
    })),
  };
}

/** Sorting tasks: all right in the end earns retry credit, otherwise the first check counts. */
function gradePlacement(
  ids: readonly string[],
  expected: Readonly<Record<string, string>>,
  answers: readonly ModuleAnswer[],
  evaluate: (assignments: Record<string, string | undefined>) => {
    correct: boolean;
    score: number;
    correctCount: number;
    result: Record<string, boolean>;
  },
): Graded {
  if (answers.length === 0) return { ...unanswered, total: ids.length, correct: 0 };
  const at = answers.length - 1;
  const first = evaluate(pickStrings(answers[0]!.response, ids, 0));
  const lastAssignments = pickStrings(answers[at]!.response, ids, at);
  const last = evaluate(lastAssignments);
  return {
    score: last.correct ? retryCredit(answers.length) : Math.max(0, Math.min(1, first.score)),
    correct: last.correctCount,
    total: ids.length,
    complete: ids.every((id) => lastAssignments[id] !== undefined),
    attempts: answers.length,
    items: ids.map((id) => ({
      id,
      correct: last.result[id] === true,
      score: last.result[id] ? 1 : 0,
      attempts: answers.length,
      response: lastAssignments[id],
      expected: expected[id],
    })),
  };
}

function gradeCategorySort(config: CategorySortConfig, answers: readonly ModuleAnswer[]): Graded {
  const { items } = config.content;
  return gradePlacement(
    items.map((i) => i.id),
    Object.fromEntries(items.map((i) => [i.id, i.categoryId])),
    answers,
    (assignments) => {
      const ev = evaluateCategorySort(items, assignments);
      return { ...ev, result: ev.items };
    },
  );
}

function gradePriorityMatrix(
  config: PriorityMatrixConfig,
  answers: readonly ModuleAnswer[],
): Graded {
  const { items } = config.content;
  return gradePlacement(
    items.map((i) => i.id),
    Object.fromEntries(items.map((i) => [i.id, i.quadrantId])),
    answers,
    (assignments) => {
      const ev = evaluatePriorityMatrix(items, assignments);
      return { ...ev, result: ev.items };
    },
  );
}

function gradeLabelDiagram(config: LabelDiagramConfig, answers: readonly ModuleAnswer[]): Graded {
  const { targets } = config.content;
  // The response holds the label text placed on each target.
  const evaluate = (placed: Record<string, string | undefined>) => {
    const result: Record<string, boolean> = {};
    for (const t of targets) result[t.id] = placed[t.id] === t.label;
    const correctCount = targets.filter((t) => result[t.id]).length;
    return {
      correct: correctCount === targets.length,
      score: targets.length ? correctCount / targets.length : 0,
      correctCount,
      result,
    };
  };
  return gradePlacement(
    targets.map((t) => t.id),
    Object.fromEntries(targets.map((t) => [t.id, t.label])),
    answers,
    evaluate,
  );
}

function gradeFillBlanks(config: FillBlanksConfig, answers: readonly ModuleAnswer[]): Graded {
  const { blanks } = config.content;
  const ids = blanks.map((b) => b.id);
  if (answers.length === 0) return { ...unanswered, total: ids.length, correct: 0 };
  const at = answers.length - 1;
  const given = pickStrings(answers[at]!.response, ids, at);
  const ev = evaluateFillBlanks(blanks, given, {
    caseSensitive: config.behavior.caseSensitive,
    lenient: config.behavior.lenient,
  });
  const n = answers.length;
  return {
    score: ev.correct ? Math.max(0.5, attemptScore(n)) : ev.score * attemptScore(n),
    correct: ev.correctCount,
    total: ids.length,
    complete: ids.every((id) => given[id] !== undefined && given[id] !== ""),
    attempts: n,
    items: blanks.map((b) => ({
      id: b.id,
      correct: ev.blanks[b.id] === true,
      score: ev.blanks[b.id] ? 1 : 0,
      attempts: n,
      response: given[b.id],
      expected: b.answers,
    })),
  };
}

function gradeInbox(config: InboxTriageConfig, answers: readonly ModuleAnswer[]): Graded {
  const { messages, actions } = config.content;
  const messageIds = new Set(messages.map((m) => m.id));
  const actionIds = new Set(actions.map((a) => a.id));
  const decisions: TriageDecisions = {};
  const counts = new Map<string, number>();
  answers.forEach((a, at) => {
    if (a.itemId === undefined || !messageIds.has(a.itemId)) bad("unknown message", at);
    if (typeof a.response !== "string" || !actionIds.has(a.response)) bad("unknown action", at);
    // A decision may be changed until the inbox is submitted: the last one counts.
    decisions[a.itemId] = a.response;
    counts.set(a.itemId, (counts.get(a.itemId) ?? 0) + 1);
  });
  const ev = evaluateTriage(config, decisions);
  return {
    score: ev.score,
    correct: ev.correct,
    total: ev.total,
    complete: ev.pending === 0,
    attempts: answers.length,
    items: ev.messages.map((m) => ({
      id: m.id,
      correct: m.status === "correct",
      score: m.points,
      attempts: counts.get(m.id) ?? 0,
      response: m.decision,
      expected: m.correctAction,
    })),
  };
}

function gradeWordBuilder(config: WordBuilderConfig, answers: readonly ModuleAnswer[]): Graded {
  const { items } = config.content;
  const graded = byIndex(answers, items.length).map((group, index): GradedItem => {
    const item = items[index]!;
    const last = group[group.length - 1];
    if (!last) return { index, correct: false, score: 0, attempts: 0, expected: item.tokens };
    const placed = stringList(last.answer.response, last.at);
    const ev = evaluateWordOrder(item, placed);
    return {
      index,
      correct: ev.correct,
      score: round4(
        scoreWordItem({ correct: ev.correct, attempts: group.length, lastScore: ev.score }),
      ),
      attempts: group.length,
      response: placed,
      expected: item.tokens,
    };
  });
  return fromItems(graded, answers.length);
}

function gradeEstimate(config: EstimateConfig, answers: readonly ModuleAnswer[]): Graded {
  const { questions } = config.content;
  const items = byIndex(answers, questions.length).map((group, index): GradedItem => {
    const q = questions[index]!;
    // A guess is locked in once: the first one counts.
    const first = group[0];
    if (!first) return { index, correct: false, score: 0, attempts: 0, expected: q.answer };
    const guess = first.answer.response;
    if (typeof guess !== "number" || !Number.isFinite(guess)) bad("expected a number", first.at);
    if (guess < q.min || guess > q.max) bad("the guess is outside the scale", first.at);
    const acc = estimateAccuracy(q, guess);
    return {
      index,
      ...(q.id ? { id: q.id } : {}),
      correct: acc.band === "bullseye",
      score: round4(acc.score),
      attempts: 1,
      response: guess,
      expected: q.answer,
    };
  });
  return fromItems(items, answers.length);
}

function gradeMatchPairs(config: MatchPairsConfig, answers: readonly ModuleAnswer[]): Graded {
  // Pairs without an id are addressed as `pair-<index>`, as in the component.
  const ids = config.content.pairs.map((p, i) => p.id ?? `pair-${i}`);
  const known = new Set(ids);
  const matched = new Set<string>();
  const tries = new Map<string, number>();
  let mistakes = 0;
  answers.forEach((a, at) => {
    if (a.itemId === undefined || !known.has(a.itemId)) bad("unknown pair", at);
    if (typeof a.response !== "string" || !known.has(a.response)) bad("unknown pair", at);
    // A matched pair leaves the board; anything sent for it afterwards is ignored.
    if (matched.has(a.itemId)) return;
    tries.set(a.itemId, (tries.get(a.itemId) ?? 0) + 1);
    if (a.itemId === a.response) matched.add(a.itemId);
    else mistakes++;
  });
  const done = ids.length ? matched.size / ids.length : 1;
  return {
    score: matchingScore(ids.length, mistakes) * done,
    correct: matched.size,
    total: ids.length,
    complete: matched.size === ids.length,
    attempts: answers.length,
    items: ids.map((id) => ({
      id,
      correct: matched.has(id),
      score: matched.has(id) ? 1 : 0,
      attempts: tries.get(id) ?? 0,
      expected: id,
    })),
  };
}

function gradeSpotTheMistake(
  config: SpotTheMistakeConfig,
  answers: readonly ModuleAnswer[],
): Graded {
  const targets = config.content.mistakes.map((m) => m.targetId);
  const isMistake = new Set(targets);
  const found = new Set<string>();
  const wrong = new Set<string>();
  answers.forEach((a, at) => {
    for (const id of stringList(a.response, at, 200)) (isMistake.has(id) ? found : wrong).add(id);
  });
  return {
    score: findAllScore(found.size, targets.length, wrong.size),
    correct: found.size,
    total: targets.length,
    // The learner may stop early and have the rest revealed.
    complete: answers.length > 0,
    attempts: answers.length,
    items: targets.map((id) => ({
      id,
      correct: found.has(id),
      score: found.has(id) ? 1 : 0,
      attempts: found.has(id) ? 1 : 0,
    })),
  };
}

function gradeScenario(config: BranchingScenarioConfig, answers: readonly ModuleAnswer[]): Graded {
  let state = startScenario(config);
  const nodes = new Map(config.content.nodes.map((n) => [n.id, n]));
  answers.forEach((a, at) => {
    if (state.finished) bad("the scenario had already ended", at);
    if (a.itemId !== state.currentId) bad("the answer does not follow the previous step", at);
    const choices = nodes.get(state.currentId)?.choices ?? [];
    const index =
      typeof a.response === "number"
        ? a.response
        : choices.findIndex((c) => c.id !== undefined && c.id === a.response);
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) bad("unknown choice", at);
    state = chooseScenario(config, state, index);
  });
  return {
    ...(config.behavior.showScore ? { score: scenarioScore(config, state) } : {}),
    complete: state.finished,
    attempts: answers.length,
    items: state.history.map((step, index) => ({
      id: step.nodeId,
      index,
      correct: step.choice.points > 0,
      score: step.choice.points,
      attempts: 1,
      response: step.choiceIndex,
    })),
  };
}

function gradeConversation(config: ConversationConfig, answers: readonly ModuleAnswer[]): Graded {
  const nodes = new Map(config.content.nodes.map((n) => [n.id, n]));
  let currentId = config.content.start;
  const chosen: ScriptedResponse[] = [];
  const done = () => {
    const node = nodes.get(currentId);
    return !node || node.responses.length === 0 || chosen.length >= config.behavior.maxSteps;
  };
  answers.forEach((a, at) => {
    if (done()) bad("the conversation had already ended", at);
    if (a.itemId !== currentId) bad("the answer does not follow the previous step", at);
    const picked = responsesOf(nodes.get(currentId)!).find((r) => r.id === a.response);
    if (!picked) bad("unknown reply", at);
    chosen.push(picked);
    currentId = picked.next;
  });
  const summary = summarizeConversation(chosen, nodes.get(currentId));
  return {
    score: summary.score,
    complete: done(),
    attempts: answers.length,
    items: chosen.map((r, index) => ({
      id: r.id,
      index,
      correct: r.effectiveness >= 0.7,
      score: r.effectiveness,
      attempts: 1,
    })),
  };
}

function gradeBudget(config: BudgetAllocatorConfig, answers: readonly ModuleAnswer[]): Graded {
  if (answers.length === 0) return unanswered;
  const at = answers.length - 1;
  const record = plainRecord(answers[at]!.response, at);
  const { channels, goal } = config.content;
  const bounds = allocationBounds(channels, config.behavior.step);
  const shares: Record<string, number> = {};
  for (const c of channels) {
    const v = hasOwn(record, c.id) ? record[c.id] : undefined;
    if (typeof v !== "number" || !Number.isFinite(v)) bad(`no share for "${c.id}"`, at);
    const { min, max } = bounds[c.id]!;
    if (v < min - 1e-6 || v > max + 1e-6) bad(`share for "${c.id}" is out of range`, at);
    shares[c.id] = v;
  }
  const sum = Object.values(shares).reduce((s, n) => s + n, 0);
  if (Math.abs(sum - 100) > 1e-6) bad("shares must add up to 100", at);
  const ev = evaluateAllocation(config, shares);
  const score = config.behavior.scoreAgainstOptimal
    ? allocationScore(ev.totalKpi, evaluateAllocation(config, optimalAllocation(config)).totalKpi)
    : goal
      ? allocationGoalProgress(config, ev)
      : undefined;
  return {
    ...(score !== undefined ? { score } : {}),
    complete: true,
    attempts: answers.length,
    items: ev.channels.map((c) => ({
      id: c.id,
      correct: true,
      score: 1,
      attempts: 1,
      response: c.share,
    })),
  };
}

const builtInGraders: Readonly<Record<string, ModuleGrader>> = {
  "choice-challenge": gradeChoice as ModuleGrader,
  "true-false": gradeTrueFalse as ModuleGrader,
  "sequence-builder": gradeSequence as ModuleGrader,
  "category-sort": gradeCategorySort as ModuleGrader,
  "priority-matrix": gradePriorityMatrix as ModuleGrader,
  "label-diagram": gradeLabelDiagram as ModuleGrader,
  "fill-blanks": gradeFillBlanks as ModuleGrader,
  "inbox-triage": gradeInbox as ModuleGrader,
  "word-builder": gradeWordBuilder as ModuleGrader,
  estimate: gradeEstimate as ModuleGrader,
  "match-pairs": gradeMatchPairs as ModuleGrader,
  "spot-the-mistake": gradeSpotTheMistake as ModuleGrader,
  "branching-scenario": gradeScenario as ModuleGrader,
  conversation: gradeConversation as ModuleGrader,
  "budget-allocator": gradeBudget as ModuleGrader,
};

/** Built-in module types `gradeModule()` can score. */
export const gradableModuleTypes: readonly string[] = Object.keys(builtInGraders);

/** Whether `gradeModule()` can score this module type. */
export function isGradable(type: string, options: Pick<GradeOptions, "graders"> = {}): boolean {
  return (
    (options.graders !== undefined && hasOwn(options.graders, type)) || hasOwn(builtInGraders, type)
  );
}

/**
 * Score a learner's response against a module config, without a browser: the same rules the
 * component applies, as one pure function. Run it where the result has to be trusted (a
 * server), with the config from your own storage and the `ModuleResult.response` the learner's
 * browser sent. Both arguments are validated; nothing is thrown for bad input.
 *
 * The score counts retries the way the component does, so for a response the component
 * produced it equals `ModuleResult.score`.
 */
export function gradeModule(
  config: unknown,
  response: unknown,
  options: GradeOptions = {},
): GradeResult {
  const valid = validateModule(config, { registry: options.registry });
  if (!valid.success) return { success: false, reason: "invalid-config", issues: valid.issues };
  const cfg = valid.data as { id: string; type: string; scoring?: { passThreshold?: number } };
  const grader =
    options.graders && hasOwn(options.graders, cfg.type)
      ? options.graders[cfg.type]
      : hasOwn(builtInGraders, cfg.type)
        ? builtInGraders[cfg.type]
        : undefined;
  if (!grader)
    return {
      success: false,
      reason: "not-gradable",
      issues: [
        {
          path: "type",
          segments: ["type"],
          message: `module type "${cfg.type}" has no answers to grade`,
        },
      ],
    };
  const parsed = moduleResponseSchema.safeParse(response);
  if (!parsed.success)
    return { success: false, reason: "invalid-response", issues: issuesFromZod(parsed.error) };
  try {
    const raw = grader(cfg as never, parsed.data.answers);
    const graded = raw.complete || raw.score === undefined ? raw : { ...raw, score: 0 };
    // The same rule as `moduleResultPassed()`: no threshold set means the default one.
    const threshold = modulePassThreshold(cfg as never);
    return {
      success: true,
      issues: [],
      grade: {
        moduleId: cfg.id,
        moduleType: cfg.type,
        ...graded,
        passed: graded.complete && (graded.score === undefined || graded.score >= threshold),
      },
    };
  } catch (error) {
    if (!(error instanceof ResponseError)) throw error;
    const segments = error.answerIndex === undefined ? [] : ["answers", error.answerIndex];
    return {
      success: false,
      reason: "invalid-response",
      issues: [
        {
          path: error.answerIndex === undefined ? "" : `answers[${error.answerIndex}]`,
          segments,
          message: error.message,
        },
      ],
    };
  }
}
