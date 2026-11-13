import { describe, expect, it } from "vitest";
import {
  allocationBounds,
  allocationGoalMet,
  allocationGoalProgress,
  allocationScore,
  budgetAllocatorSchema,
  channelOutput,
  evaluateAllocation,
  initialShares,
  optimalAllocation,
  rebalance,
  validateModule,
  type AllocationShares,
} from "../src";

const sum = (s: AllocationShares) => Object.values(s).reduce((a, b) => a + b, 0);

const base = {
  id: "plan",
  type: "budget-allocator",
  content: {
    totalBudget: 100_000,
    kpiLabel: "Conversions",
    channels: [
      { id: "a", label: "A", efficiency: 50, saturation: 0.5 },
      { id: "b", label: "B", efficiency: 20, saturation: 0.9 },
      { id: "c", label: "C", efficiency: 10, saturation: 1 },
      { id: "d", label: "D", efficiency: 30, saturation: 0.6 },
    ],
    initial: { a: 25, b: 25, c: 25, d: 25 },
    goal: { description: "Reach 1,000", minKpi: 1000 },
  },
} as const;

const config = budgetAllocatorSchema.parse(base);

describe("budget-allocator schema", () => {
  it("applies defaults", () => {
    expect(config.content.currency).toBe("USD");
    expect(config.behavior).toEqual({
      step: 5,
      allowLock: true,
      showOptimal: true,
      scoreAgainstOptimal: true,
    });
  });

  it("rejects shares that do not sum to 100, unknown and missing ids", () => {
    const res = validateModule({
      ...base,
      content: { ...base.content, initial: { a: 30, b: 25, c: 25, x: 25 } },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const messages = res.issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/unknown channel "x"/);
    expect(messages).toMatch(/missing a share for channel "d"/);
    expect(messages).toMatch(/sum to 100 \(got 80\)/);
  });

  it("validates step, grid, min/max and goal", () => {
    const res = validateModule({
      ...base,
      content: {
        ...base.content,
        channels: [
          { id: "a", label: "A", efficiency: 50, saturation: 0.5, min: 60, max: 40 },
          { id: "a", label: "A2", efficiency: 20, saturation: 0.9 },
          { id: "c", label: "C", efficiency: 10, saturation: 1 },
        ],
        initial: { a: 33, c: 67 },
        goal: { description: "Do well" },
      },
      behavior: { step: 3 },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const messages = res.issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/step must divide 100/);
    expect(messages).toMatch(/duplicate channel id "a"/);
    expect(messages).toMatch(/max must be greater than or equal to min/);
    expect(messages).toMatch(/goal needs minKpi/);
  });

  it("rejects infeasible minimums and saturation out of range", () => {
    expect(
      budgetAllocatorSchema.safeParse({
        ...base,
        content: {
          ...base.content,
          channels: base.content.channels.map((c) => ({ ...c, min: 30 })),
          initial: { a: 25, b: 25, c: 25, d: 25 },
        },
      }).success,
    ).toBe(false);
    expect(
      budgetAllocatorSchema.safeParse({
        ...base,
        content: {
          ...base.content,
          channels: [
            { ...base.content.channels[0], saturation: 0.1 },
            ...base.content.channels.slice(1),
          ],
        },
      }).success,
    ).toBe(false);
  });
});

describe("budget-allocator logic", () => {
  it("computes channel output with diminishing returns", () => {
    expect(channelOutput(1000, { efficiency: 50, saturation: 0.5 })).toBe(50);
    expect(channelOutput(4000, { efficiency: 50, saturation: 0.5 })).toBe(100);
    expect(channelOutput(4000, { efficiency: 10, saturation: 1 })).toBe(40);
    expect(channelOutput(0, { efficiency: 10, saturation: 1 })).toBe(0);
    expect(channelOutput(-5, { efficiency: 10, saturation: 1 })).toBe(0);
  });

  it("evaluates an allocation", () => {
    const ev = evaluateAllocation(config, initialShares(config));
    expect(ev.totalSpend).toBe(100_000);
    expect(ev.channels.map((c) => c.spend)).toEqual([25_000, 25_000, 25_000, 25_000]);
    expect(ev.channels[0]!.output).toBeCloseTo(250, 6); // 50 × √25
    expect(ev.channels[2]!.output).toBeCloseTo(250, 6); // 10 × 25
    expect(ev.totalKpi).toBeCloseTo(
      ev.channels.reduce((s, c) => s + c.output, 0),
      9,
    );
    expect(ev.costPerKpi).toBeCloseTo(100_000 / ev.totalKpi, 9);
    const empty = evaluateAllocation(config, { a: 0, b: 0, c: 0, d: 0 });
    expect(empty.costPerKpi).toBe(Infinity);
  });

  it("snaps bounds inward to the step grid", () => {
    expect(allocationBounds([{ id: "x", min: 12, max: 38 }, { id: "y" }], 5)).toEqual({
      x: { min: 15, max: 35 },
      y: { min: 0, max: 100 },
    });
  });

  it("rebalances proportionally and keeps the total at exactly 100", () => {
    const start = { a: 40, b: 30, c: 20, d: 10 };
    const next = rebalance(start, "a", 60, [], 5);
    expect(next.a).toBe(60);
    expect(sum(next)).toBe(100);
    // 20 points taken from b/c/d proportionally to 30/20/10 → 10/6.67/3.33 → rounded on the grid.
    expect(next).toEqual({ a: 60, b: 20, c: 15, d: 5 });
    // Giving back is proportional to the current shares as well.
    const back = rebalance(next, "a", 40, [], 5);
    expect(sum(back)).toBe(100);
    expect(back.a).toBe(40);
    expect(back.b).toBeGreaterThan(back.d!);
  });

  it("leaves locked channels untouched", () => {
    const start = { a: 25, b: 25, c: 25, d: 25 };
    const next = rebalance(start, "a", 45, ["b"], 5);
    expect(next.b).toBe(25);
    expect(next.a).toBe(45);
    expect(sum(next)).toBe(100);
    expect(rebalance(start, "b", 50, new Set(["b"]), 5)).toEqual(start);
  });

  it("clamps to what the unlocked channels can absorb", () => {
    const start = { a: 25, b: 25, c: 25, d: 25 };
    // Only c can move: a can go at most to 50.
    expect(rebalance(start, "a", 90, ["b", "d"], 5)).toEqual({ a: 50, b: 25, c: 0, d: 25 });
    // Everything else locked: nothing can change.
    expect(rebalance(start, "a", 40, ["b", "c", "d"], 5)).toEqual(start);
  });

  it("respects min/max bounds of every channel", () => {
    const bounds = {
      a: { min: 0, max: 50 },
      b: { min: 20, max: 100 },
      c: { min: 0, max: 30 },
      d: { min: 0, max: 100 },
    };
    const start = { a: 25, b: 25, c: 25, d: 25 };
    const up = rebalance(start, "a", 100, [], 5, bounds);
    expect(up.a).toBe(50);
    expect(up.b).toBeGreaterThanOrEqual(20);
    expect(sum(up)).toBe(100);
    const down = rebalance(start, "d", 0, [], 5, bounds);
    expect(down.c).toBeLessThanOrEqual(30);
    expect(down.a).toBeLessThanOrEqual(50);
    expect(sum(down)).toBe(100);
  });

  it("is deterministic and handles rounding drift and zero shares", () => {
    const start = { a: 100, b: 0, c: 0, d: 0 };
    const next = rebalance(start, "a", 85, [], 5);
    expect(sum(next)).toBe(100);
    // All others had zero share: the freed points are spread evenly, ties to the first channel.
    expect(next).toEqual({ a: 85, b: 5, c: 5, d: 5 });
    const thirds = rebalance({ a: 10, b: 30, c: 30, d: 30 }, "a", 20, [], 5);
    expect(thirds).toEqual({ a: 20, b: 25, c: 25, d: 30 });
    expect(rebalance({ a: 10, b: 30, c: 30, d: 30 }, "a", 20, [], 5)).toEqual(thirds);
    // Off-grid requests snap to the step; fractional steps work too.
    expect(rebalance({ a: 25, b: 25, c: 25, d: 25 }, "a", 31, [], 5).a).toBe(30);
    const fine = rebalance({ a: 25, b: 25, c: 25, d: 25 }, "a", 27.5, [], 2.5);
    expect(fine.a).toBe(27.5);
    expect(sum(fine)).toBeCloseTo(100, 9);
  });

  it("finds the greedy optimum respecting min/max", () => {
    const opt = optimalAllocation(config);
    expect(sum(opt)).toBe(100);
    const optKpi = evaluateAllocation(config, opt).totalKpi;
    // No single step move improves on it.
    for (const from of Object.keys(opt)) {
      for (const to of Object.keys(opt)) {
        if (from === to || opt[from]! < 5) continue;
        const moved = { ...opt, [from]: opt[from]! - 5, [to]: opt[to]! + 5 };
        expect(evaluateAllocation(config, moved).totalKpi).toBeLessThanOrEqual(optKpi + 1e-9);
      }
    }
    const capped = budgetAllocatorSchema.parse({
      ...base,
      content: {
        ...base.content,
        channels: base.content.channels.map((c) =>
          c.id === "a" ? { ...c, max: 20 } : c.id === "c" ? { ...c, min: 10 } : c,
        ),
        initial: { a: 20, b: 30, c: 25, d: 25 },
      },
    });
    const optCapped = optimalAllocation(capped);
    expect(optCapped.a).toBeLessThanOrEqual(20);
    expect(optCapped.c).toBeGreaterThanOrEqual(10);
    expect(sum(optCapped)).toBe(100);
  });

  it("puts everything into the best linear channel", () => {
    const linear = budgetAllocatorSchema.parse({
      ...base,
      content: {
        ...base.content,
        channels: [
          { id: "a", label: "A", efficiency: 5, saturation: 1 },
          { id: "b", label: "B", efficiency: 9, saturation: 1 },
          { id: "c", label: "C", efficiency: 7, saturation: 1 },
        ],
        initial: { a: 30, b: 40, c: 30 },
      },
    });
    expect(optimalAllocation(linear)).toEqual({ a: 0, b: 100, c: 0 });
  });

  it("scores against the optimum and evaluates goals", () => {
    expect(allocationScore(50, 100)).toBe(0.5);
    expect(allocationScore(120, 100)).toBe(1);
    expect(allocationScore(0, 100)).toBe(0);
    expect(allocationScore(10, 0)).toBe(1);

    const ev = evaluateAllocation(config, initialShares(config));
    expect(allocationGoalMet(config, ev)).toBe(ev.totalKpi >= 1000);
    expect(allocationGoalProgress(config, ev)).toBeCloseTo(Math.min(1, ev.totalKpi / 1000), 9);

    const cpk = budgetAllocatorSchema.parse({
      ...base,
      content: { ...base.content, goal: { description: "Cheap", maxCostPerKpi: 1000 } },
    });
    expect(allocationGoalMet(cpk, ev)).toBe(true);
    const noGoal = budgetAllocatorSchema.parse({
      ...base,
      content: { ...base.content, goal: undefined },
    });
    expect(allocationGoalMet(noGoal, ev)).toBe(false);
    expect(allocationGoalProgress(noGoal, ev)).toBe(0);
  });
});
