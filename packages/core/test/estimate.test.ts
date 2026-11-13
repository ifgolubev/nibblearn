import { describe, expect, it } from "vitest";
import {
  estimateAccuracy,
  estimateSchema,
  estimateStart,
  estimateTolerance,
  formatEstimate,
  formatEstimateDelta,
  snapEstimate,
  validateModule,
} from "../src";

const q = { prompt: "?", min: 0, max: 100, step: 1, answer: 40, format: "number" as const };

describe("estimate schema", () => {
  it("applies defaults", () => {
    const cfg = estimateSchema.parse({
      id: "e",
      type: "estimate",
      content: { questions: [{ prompt: "How many?", min: 0, max: 10, answer: 4 }] },
    });
    expect(cfg.content.currency).toBe("USD");
    expect(cfg.content.questions[0]!.step).toBe(1);
    expect(cfg.content.questions[0]!.format).toBe("number");
    expect(cfg.behavior.showCounter).toBe(true);
  });

  it("rejects answers outside the range, min ≥ max and duplicate ids", () => {
    const res = validateModule({
      id: "e",
      type: "estimate",
      content: {
        questions: [
          { id: "a", prompt: "1", min: 0, max: 10, answer: 11 },
          { id: "a", prompt: "2", min: 5, max: 5, answer: 5 },
          { prompt: "3", min: 0, max: 1, step: 2, answer: 0.5 },
        ],
      },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const messages = res.issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/answer must be within/);
    expect(messages).toMatch(/max must be greater than min/);
    expect(messages).toMatch(/duplicate question id "a"/);
    expect(messages).toMatch(/step must not be larger than the range/);
  });

  it("rejects an empty question list", () => {
    expect(
      estimateSchema.safeParse({ id: "e", type: "estimate", content: { questions: [] } }).success,
    ).toBe(false);
  });
});

describe("estimate logic", () => {
  it("defaults tolerance to 5% of the range", () => {
    expect(estimateTolerance(q)).toBe(5);
    expect(estimateTolerance({ ...q, tolerance: 2 })).toBe(2);
  });

  it("classifies bands at the edges", () => {
    expect(estimateAccuracy(q, 40).band).toBe("bullseye");
    expect(estimateAccuracy(q, 45).band).toBe("bullseye");
    expect(estimateAccuracy(q, 35).band).toBe("bullseye");
    expect(estimateAccuracy(q, 46).band).toBe("close");
    expect(estimateAccuracy(q, 55).band).toBe("close");
    expect(estimateAccuracy(q, 56).band).toBe("off");
    expect(estimateAccuracy(q, 0).band).toBe("off");
  });

  it("scores 1 within tolerance, falling linearly to 0 at 30% of the range", () => {
    expect(estimateAccuracy(q, 44).score).toBe(1);
    // tolerance 5, zero at 30 → halfway (17.5 away) scores 0.5
    expect(estimateAccuracy(q, 57.5).score).toBeCloseTo(0.5, 9);
    expect(estimateAccuracy(q, 70).score).toBe(0);
    expect(estimateAccuracy(q, 100).score).toBe(0);
    const acc = estimateAccuracy(q, 52);
    expect(acc.delta).toBe(12);
    expect(acc.error).toBe(12);
    expect(estimateAccuracy(q, 30).delta).toBe(-10);
  });

  it("handles a tolerance wider than the zero point", () => {
    const wide = { ...q, tolerance: 40 };
    expect(estimateAccuracy(wide, 80).score).toBe(1);
    expect(estimateAccuracy(wide, 81).score).toBe(0);
  });

  it("is robust to floating point on percent scales", () => {
    const pct = { prompt: "?", min: 0, max: 0.1, step: 0.001, answer: 0.028, tolerance: 0.004 };
    expect(estimateAccuracy(pct, 0.032).band).toBe("bullseye");
    expect(estimateAccuracy(pct, 0.024).band).toBe("bullseye");
    expect(estimateAccuracy(pct, 0.04).band).toBe("close");
  });

  it("snaps guesses to the grid and starts in the middle", () => {
    expect(snapEstimate({ min: 0, max: 0.1, step: 0.001 }, 0.0284)).toBe(0.028);
    expect(snapEstimate({ min: 5, max: 60, step: 0.5 }, 100)).toBe(60);
    expect(snapEstimate({ min: 5, max: 60, step: 0.5 }, Number.NaN)).toBe(5);
    expect(estimateStart({ min: 0, max: 10, step: 1 })).toBe(5);
    expect(estimateStart({ min: 0, max: 0.6, step: 0.001 })).toBe(0.3);
  });

  it("formats values and deltas with units and percentage points", () => {
    expect(formatEstimate({ format: "percent", step: 0.001 }, 0.028)).toBe("2.8%");
    expect(formatEstimate({ format: "currency" }, 21.4)).toBe("$21.40");
    expect(formatEstimate({ format: "currency" }, 21.4, { currency: "EUR" })).toBe("€21.40");
    expect(formatEstimate({ format: "currency", step: 1 }, 38)).toBe("$38");
    expect(formatEstimate({ format: "currency", step: 0.1 }, 21)).toBe("$21.00");
    expect(formatEstimate({ format: "number", unit: "×" }, 4.1)).toBe("4.1×");
    expect(formatEstimate({ format: "integer", unit: "clicks" }, 1200)).toBe("1,200\u00a0clicks");
    expect(formatEstimateDelta({ format: "percent" }, 0.004)).toBe("0.4\u00a0pp");
    expect(formatEstimateDelta({ format: "percent" }, -0.0125, { pointsLabel: "pts" })).toBe(
      "1.25\u00a0pts",
    );
    expect(formatEstimateDelta({ format: "currency" }, -2.5)).toBe("$2.50");
    expect(formatEstimateDelta({ format: "number", unit: "×" }, 0.3)).toBe("0.3×");
  });
});
