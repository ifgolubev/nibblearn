import type {
  BranchingScenarioConfig,
  ScenarioChoice,
  ScenarioNode,
} from "../schema/modules/branching-scenario";

export interface ScenarioStep {
  nodeId: string;
  choiceIndex: number;
  choice: ScenarioChoice;
}

export interface ScenarioState {
  currentId: string;
  history: ScenarioStep[];
  points: number;
  finished: boolean;
}

export function nodeMap(config: BranchingScenarioConfig): Map<string, ScenarioNode> {
  return new Map(config.content.nodes.map((n) => [n.id, n]));
}

export function startScenario(config: BranchingScenarioConfig): ScenarioState {
  const node = nodeMap(config).get(config.content.start);
  return {
    currentId: config.content.start,
    history: [],
    points: 0,
    finished: node?.kind === "ending",
  };
}

export function chooseScenario(
  config: BranchingScenarioConfig,
  state: ScenarioState,
  choiceIndex: number,
): ScenarioState {
  if (state.finished) return state;
  const nodes = nodeMap(config);
  const node = nodes.get(state.currentId);
  const choice = node?.choices[choiceIndex];
  if (!node || !choice) return state;
  const next = nodes.get(choice.next);
  if (!next) return state;
  const history = [...state.history, { nodeId: node.id, choiceIndex, choice }];
  const finished = next.kind === "ending" || history.length >= config.behavior.maxSteps;
  return { currentId: next.id, history, points: state.points + choice.points, finished };
}

/**
 * Maximum points reachable from the start node (longest-score path). Cycles are
 * cut by the visited set so the computation terminates.
 */
export function scenarioMaxPoints(config: BranchingScenarioConfig): number {
  if (typeof config.behavior.maxPoints === "number") return config.behavior.maxPoints;
  const nodes = nodeMap(config);
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const best = (id: string): number => {
    const node = nodes.get(id);
    if (!node || node.kind === "ending" || node.choices.length === 0) return 0;
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let max = -Infinity;
    for (const c of node.choices) max = Math.max(max, c.points + best(c.next));
    visiting.delete(id);
    const v = Number.isFinite(max) ? max : 0;
    memo.set(id, v);
    return v;
  };
  return Math.max(0, best(config.content.start));
}

export function scenarioScore(config: BranchingScenarioConfig, state: ScenarioState): number {
  const max = scenarioMaxPoints(config);
  if (max <= 0) {
    // No points configured: score by ending outcome.
    const node = nodeMap(config).get(state.currentId);
    return node?.outcome === "success" ? 1 : node?.outcome === "failure" ? 0 : 0.5;
  }
  return Math.max(0, Math.min(1, state.points / max));
}

/** Ids of nodes that can never be reached from the start. */
export function unreachableNodes(config: BranchingScenarioConfig): string[] {
  const nodes = nodeMap(config);
  const seen = new Set<string>();
  const stack = [config.content.start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.get(id)?.choices.forEach((c) => stack.push(c.next));
  }
  return config.content.nodes.map((n) => n.id).filter((id) => !seen.has(id));
}
