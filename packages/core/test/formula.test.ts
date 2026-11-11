import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateFormula, parseFormula } from "../src";

describe("formula", () => {
  it("evaluates arithmetic with precedence", () => {
    expect(evaluateFormula("1 + 2 * 3", {})).toBe(7);
    expect(evaluateFormula("(1 + 2) * 3", {})).toBe(9);
    expect(evaluateFormula("-spend / 2", { spend: 10 })).toBe(-5);
    expect(evaluateFormula("spend % 3", { spend: 10 })).toBe(1);
  });
  it("supports functions and comparisons", () => {
    expect(evaluateFormula("max(1, 5, 3)", {})).toBe(5);
    expect(evaluateFormula("round(2.345, 2)", {})).toBe(2.35);
    expect(evaluateFormula("clamp(50, 0, 10)", {})).toBe(10);
    expect(evaluateCondition("cpa > 50 and roas < 2", { cpa: 60, roas: 1 })).toBe(true);
    expect(evaluateCondition("not (cpa > 50) or roas < 2", { cpa: 60, roas: 3 })).toBe(false);
  });
  it("handles division by zero safely", () => {
    expect(evaluateFormula("1 / 0", {})).toBe(Infinity);
    expect(evaluateFormula("0 / 0", {})).toBe(0);
    expect(evaluateCondition("1 / 0 > 5", {})).toBe(true);
  });
  it("rejects unknown functions and bad syntax without executing code", () => {
    expect(parseFormula("alert(1)").ok).toBe(false);
    expect(parseFormula("window.location").ok).toBe(false);
    expect(parseFormula("1 +").ok).toBe(false);
    expect(parseFormula("(1 + 2").ok).toBe(false);
    expect(() => evaluateFormula("foo + 1", {})).toThrow(/unknown identifier/);
  });
  it("collects references", () => {
    const r = parseFormula("spend / clicks * 100");
    expect(r.ok && r.refs.sort()).toEqual(["clicks", "spend"]);
  });
});

describe("formula scope safety", () => {
  it("never resolves identifiers through the prototype chain", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(() => evaluateFormula(`${name} + 1`, {}), name).toThrow(/unknown identifier/);
    }
    expect(() => evaluateFormula("__proto__ + 1", {})).toThrow();
  });
});
