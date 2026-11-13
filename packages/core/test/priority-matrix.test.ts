import { describe, expect, it } from "vitest";
import {
  QUADRANT_POSITIONS,
  evaluatePriorityMatrix,
  priorityMatrixSchema,
  priorityMatrixScore,
  quadrantCell,
  sortQuadrants,
  validateModule,
} from "../src";

const quadrants = [
  { id: "do", position: "top-right", label: "Do now" },
  { id: "schedule", position: "top-left", label: "Schedule" },
  { id: "delegate", position: "bottom-right", label: "Delegate" },
  { id: "drop", position: "bottom-left", label: "Drop" },
] as const;

const base = {
  id: "m",
  type: "priority-matrix",
  content: {
    axes: {
      x: { label: "Urgency", low: "low", high: "high" },
      y: { label: "Importance", low: "low", high: "high" },
    },
    quadrants: [...quadrants],
    items: [
      { id: "a", text: "Fix tracking", quadrantId: "do" },
      { id: "b", text: "Plan Q3", quadrantId: "schedule" },
      { id: "c", text: "Weekly export", quadrantId: "delegate" },
      { id: "d", text: "Tidy archive", quadrantId: "drop" },
    ],
  },
};

describe("priority-matrix schema", () => {
  it("applies defaults", () => {
    const cfg = priorityMatrixSchema.parse(base);
    expect(cfg.behavior).toEqual({
      allowRetry: true,
      maxAttempts: 0,
      showExplanation: true,
      shuffle: true,
    });
  });

  it("requires exactly four quadrants with unique ids and positions", () => {
    const three = validateModule({
      ...base,
      content: { ...base.content, quadrants: quadrants.slice(0, 3) },
    });
    expect(three.success).toBe(false);

    const res = validateModule({
      ...base,
      content: {
        ...base.content,
        quadrants: [
          quadrants[0],
          { ...quadrants[1], position: "top-right" },
          quadrants[2],
          { ...quadrants[3], id: "do" },
        ],
      },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const messages = res.issues.map((i) => `${i.path}: ${i.message}`).join("\n");
    expect(messages).toMatch(/quadrants\[1\]\.position: position "top-right" is used by more/);
    expect(messages).toMatch(/quadrants\[3\]\.id: duplicate quadrant id "do"/);
  });

  it("checks item ids, item count and quadrant references", () => {
    const res = validateModule({
      ...base,
      content: {
        ...base.content,
        items: [
          { id: "a", text: "1", quadrantId: "do" },
          { id: "a", text: "2", quadrantId: "nowhere" },
          { id: "c", text: "3", quadrantId: "drop" },
        ],
      },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const messages = res.issues.map((i) => `${i.path}: ${i.message}`).join("\n");
    expect(messages).toMatch(/items\[1\]\.id: duplicate item id "a"/);
    expect(messages).toMatch(/items\[1\]\.quadrantId: item "a" refers to unknown quadrant/);

    const tooFew = validateModule({
      ...base,
      content: { ...base.content, items: base.content.items.slice(0, 2) },
    });
    expect(tooFew.success).toBe(false);
  });
});

describe("priority-matrix logic", () => {
  it("maps positions to grid cells and axis levels", () => {
    expect(quadrantCell("top-left")).toEqual({ row: 1, column: 1, x: "low", y: "high" });
    expect(quadrantCell("top-right")).toEqual({ row: 1, column: 2, x: "high", y: "high" });
    expect(quadrantCell("bottom-left")).toEqual({ row: 2, column: 1, x: "low", y: "low" });
    expect(quadrantCell("bottom-right")).toEqual({ row: 2, column: 2, x: "high", y: "low" });
    expect(sortQuadrants(quadrants).map((q) => q.position)).toEqual([...QUADRANT_POSITIONS]);
  });

  it("evaluates placements", () => {
    const items = base.content.items;
    const ev = evaluatePriorityMatrix(items, { a: "do", b: "do", c: "delegate" });
    expect(ev.correct).toBe(false);
    expect(ev.items).toEqual({ a: true, b: false, c: true, d: false });
    expect(ev.correctCount).toBe(2);
    expect(ev.unassigned).toBe(1);
    expect(ev.score).toBe(0.5);
    const all = evaluatePriorityMatrix(items, {
      a: "do",
      b: "schedule",
      c: "delegate",
      d: "drop",
    });
    expect(all).toMatchObject({ correct: true, correctCount: 4, score: 1 });
  });

  it("scores attempts, reveals and first-check fractions", () => {
    const s = (attempts: number, allCorrect: boolean, firstFraction: number, revealed = false) =>
      priorityMatrixScore({ attempts, allCorrect, firstFraction, revealed });
    expect(s(1, true, 1)).toBe(1);
    expect(s(2, true, 0.5)).toBe(0.75);
    expect(s(5, true, 0.25)).toBe(0.5);
    expect(s(4, true, 0.875)).toBe(0.875);
    expect(s(2, false, 0.625)).toBe(0.625);
    expect(s(3, false, 0.5, true)).toBe(0.5);
  });
});
