import type { BudgetAllocatorConfig, BudgetChannel } from "../schema/modules/budget-allocator";

/** Channel id → share of the budget in percent. */
export type AllocationShares = Record<string, number>;

/** Effective min/max share (percent) per channel. */
export type AllocationBounds = Record<string, { min: number; max: number }>;

export interface ChannelAllocationResult {
  id: string;
  /** Share of the budget in percent. */
  share: number;
  /** Money allocated to the channel. */
  spend: number;
  /** KPI units produced by that spend. */
  output: number;
}

export interface AllocationEvaluation {
  channels: ChannelAllocationResult[];
  totalSpend: number;
  totalKpi: number;
  /** Spend ÷ KPI. `Infinity` when the plan produces nothing. */
  costPerKpi: number;
}

const EPS = 1e-9;

/** Round away floating-point noise (e.g. 0.1 + 0.2). */
function clean(v: number): number {
  return Number(v.toFixed(6));
}

/**
 * KPI produced by `spend` on a channel with diminishing returns:
 * `efficiency × (spend / 1000) ^ saturation`.
 */
export function channelOutput(
  spend: number,
  channel: Pick<BudgetChannel, "efficiency" | "saturation">,
): number {
  if (!Number.isFinite(spend) || spend <= 0) return 0;
  return channel.efficiency * Math.pow(spend / 1000, channel.saturation);
}

/** Starting shares in channel order. */
export function initialShares(config: BudgetAllocatorConfig): AllocationShares {
  return Object.fromEntries(
    config.content.channels.map((c) => [c.id, config.content.initial[c.id] ?? 0]),
  );
}

/**
 * Min/max share per channel snapped inward to the step grid, so every reachable value is a
 * multiple of `step`.
 */
export function allocationBounds(
  channels: readonly Pick<BudgetChannel, "id" | "min" | "max">[],
  step: number,
): AllocationBounds {
  const out: AllocationBounds = {};
  for (const c of channels) {
    const min = clean(Math.ceil((c.min ?? 0) / step - EPS) * step);
    const max = clean(Math.floor((c.max ?? 100) / step + EPS) * step);
    out[c.id] = { min: Math.max(0, min), max: Math.min(100, Math.max(min, max)) };
  }
  return out;
}

/** Spend, output, total KPI and cost per KPI for a split. */
export function evaluateAllocation(
  config: BudgetAllocatorConfig,
  shares: AllocationShares,
): AllocationEvaluation {
  const total = config.content.totalBudget;
  const channels = config.content.channels.map((c) => {
    const share = shares[c.id] ?? 0;
    const spend = (total * share) / 100;
    return { id: c.id, share, spend, output: channelOutput(spend, c) };
  });
  const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
  const totalKpi = channels.reduce((s, c) => s + c.output, 0);
  return {
    channels,
    totalSpend,
    totalKpi,
    costPerKpi: totalKpi > 0 ? totalSpend / totalKpi : Infinity,
  };
}

/**
 * Distribute `amount` (≥ 0, real) across items proportionally to `weights`, never exceeding
 * each item's `cap`. Items whose weight is zero only receive a share once every weighted item
 * is capped. Returns real-valued allocations.
 */
function proportionalFill(amount: number, weights: number[], caps: number[]): number[] {
  const alloc = weights.map(() => 0);
  let remaining = amount;
  let active = weights.map((_, i) => i).filter((i) => caps[i]! > EPS);
  while (remaining > EPS && active.length > 0) {
    let wSum = active.reduce((s, i) => s + weights[i]!, 0);
    const useEqual = wSum <= EPS;
    if (useEqual) wSum = active.length;
    const w = (i: number) => (useEqual ? 1 : weights[i]!);
    // Anyone who would overflow is capped first; then everyone else shares what is left.
    const overflow = active.filter((i) => alloc[i]! + (remaining * w(i)) / wSum > caps[i]! + EPS);
    if (overflow.length === 0) {
      for (const i of active) alloc[i] = alloc[i]! + (remaining * w(i)) / wSum;
      remaining = 0;
      break;
    }
    for (const i of overflow) {
      remaining -= caps[i]! - alloc[i]!;
      alloc[i] = caps[i]!;
    }
    active = active.filter((i) => !overflow.includes(i));
  }
  return alloc;
}

/**
 * Integer rounding that preserves the total (largest-remainder method). Ties go to the item
 * listed first, so the result is deterministic.
 */
function roundPreservingTotal(values: number[], total: number): number[] {
  const floors = values.map((v) => Math.floor(v + EPS));
  let leftover = total - floors.reduce((s, v) => s + v, 0);
  const order = values
    .map((v, i) => ({ i, frac: v - floors[i]! }))
    .filter((x) => x.frac > EPS)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (leftover <= 0) break;
    floors[i] = floors[i]! + 1;
    leftover -= 1;
  }
  return floors;
}

/**
 * Change one channel's share and rebalance the others so the total stays exactly 100.
 *
 * The difference is spread across the other *unlocked* channels in proportion to their current
 * share (above their minimum when shrinking), respecting `bounds`. All values are kept on the
 * `step` grid; rounding drift is resolved with the largest-remainder method (ties → first
 * channel). If the requested value cannot be absorbed, it is clamped to the nearest feasible
 * value. A locked `changedId` returns the shares unchanged.
 */
export function rebalance(
  shares: AllocationShares,
  changedId: string,
  newValue: number,
  locked: readonly string[] | ReadonlySet<string>,
  step: number,
  bounds: AllocationBounds = {},
): AllocationShares {
  const ids = Object.keys(shares);
  if (!ids.includes(changedId) || !Number.isFinite(newValue) || step <= 0) return { ...shares };
  const isLocked = (id: string) =>
    Array.isArray(locked) ? locked.includes(id) : (locked as ReadonlySet<string>).has(id);
  if (isLocked(changedId)) return { ...shares };

  // Work in integer "step units" so every value stays on the grid.
  const totalUnits = Math.round(100 / step);
  const toUnits = (v: number) => Math.round(v / step);
  const lo = (id: string) => toUnits(bounds[id]?.min ?? 0);
  const hi = (id: string) => toUnits(bounds[id]?.max ?? 100);

  const others = ids.filter((id) => id !== changedId && !isLocked(id));
  const lockedUnits = ids
    .filter((id) => id !== changedId && isLocked(id))
    .reduce((s, id) => s + toUnits(shares[id] ?? 0), 0);

  const othersLo = others.reduce((s, id) => s + lo(id), 0);
  const othersHi = others.reduce((s, id) => s + hi(id), 0);
  const feasibleMin = Math.max(lo(changedId), totalUnits - lockedUnits - othersHi);
  const feasibleMax = Math.min(hi(changedId), totalUnits - lockedUnits - othersLo);
  if (feasibleMin > feasibleMax) return { ...shares };
  const target = Math.min(feasibleMax, Math.max(feasibleMin, toUnits(newValue)));

  const current = others.map((id) => toUnits(shares[id] ?? 0));
  const currentSum = current.reduce((s, v) => s + v, 0);
  const delta = totalUnits - lockedUnits - target - currentSum;

  let next: number[];
  if (delta === 0) {
    next = current;
  } else if (delta > 0) {
    const caps = others.map((id, i) => Math.max(0, hi(id) - current[i]!));
    const add = proportionalFill(delta, current, caps);
    const rounded = roundPreservingTotal(add, delta);
    next = current.map((v, i) => v + rounded[i]!);
  } else {
    const caps = others.map((id, i) => Math.max(0, current[i]! - lo(id)));
    const take = proportionalFill(-delta, caps, caps);
    const rounded = roundPreservingTotal(take, -delta);
    next = current.map((v, i) => v - rounded[i]!);
  }

  const out: AllocationShares = {};
  for (const id of ids) {
    if (id === changedId) out[id] = clean(target * step);
    else if (isLocked(id)) out[id] = shares[id] ?? 0;
    else out[id] = clean(next[others.indexOf(id)]! * step);
  }
  return out;
}

/**
 * The best split on the `step` grid, found greedily: start every channel at its minimum and
 * give each next increment to the channel with the highest marginal KPI (ties → first channel).
 * Optimal for concave response curves (saturation ≤ 1).
 */
export function optimalAllocation(config: BudgetAllocatorConfig): AllocationShares {
  const { channels, totalBudget } = config.content;
  const step = config.behavior.step;
  const bounds = allocationBounds(channels, step);
  const totalUnits = Math.round(100 / step);
  const units = channels.map((c) => Math.round(bounds[c.id]!.min / step));
  const maxUnits = channels.map((c) => Math.round(bounds[c.id]!.max / step));
  const spendOf = (u: number) => (totalBudget * u * step) / 100;
  let remaining = totalUnits - units.reduce((s, u) => s + u, 0);
  while (remaining > 0) {
    let best = -1;
    let bestGain = -Infinity;
    channels.forEach((c, i) => {
      if (units[i]! >= maxUnits[i]!) return;
      const gain = channelOutput(spendOf(units[i]! + 1), c) - channelOutput(spendOf(units[i]!), c);
      if (gain > bestGain + EPS) {
        bestGain = gain;
        best = i;
      }
    });
    if (best < 0) break;
    units[best] = units[best]! + 1;
    remaining -= 1;
  }
  return Object.fromEntries(channels.map((c, i) => [c.id, clean(units[i]! * step)]));
}

/** Learner KPI as a fraction of the optimal KPI, clamped to 0–1. */
export function allocationScore(learnerKpi: number, optimalKpi: number): number {
  if (!Number.isFinite(learnerKpi) || learnerKpi <= 0) return 0;
  if (!Number.isFinite(optimalKpi) || optimalKpi <= 0) return 1;
  return Math.min(1, Math.max(0, learnerKpi / optimalKpi));
}

/** Whether the evaluation satisfies the configured goal (false when there is no goal). */
export function allocationGoalMet(
  config: BudgetAllocatorConfig,
  evaluation: AllocationEvaluation,
): boolean {
  const goal = config.content.goal;
  if (!goal || (goal.minKpi === undefined && goal.maxCostPerKpi === undefined)) return false;
  if (goal.minKpi !== undefined && evaluation.totalKpi < goal.minKpi - EPS) return false;
  if (goal.maxCostPerKpi !== undefined && !(evaluation.costPerKpi <= goal.maxCostPerKpi + EPS))
    return false;
  return true;
}

/**
 * Progress towards the goal, 0–1 (the weakest criterion wins). 1 when met, 0 without a goal.
 */
export function allocationGoalProgress(
  config: BudgetAllocatorConfig,
  evaluation: AllocationEvaluation,
): number {
  const goal = config.content.goal;
  if (!goal) return 0;
  const parts: number[] = [];
  if (goal.minKpi !== undefined) parts.push(evaluation.totalKpi / goal.minKpi);
  if (goal.maxCostPerKpi !== undefined)
    parts.push(
      Number.isFinite(evaluation.costPerKpi) && evaluation.costPerKpi > 0
        ? goal.maxCostPerKpi / evaluation.costPerKpi
        : 0,
    );
  if (parts.length === 0) return 0;
  return Math.min(1, Math.max(0, Math.min(...parts)));
}
