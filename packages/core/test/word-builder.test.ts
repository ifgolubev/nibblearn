import { describe, expect, it } from "vitest";
import {
  acceptedWordOrders,
  buildWordTiles,
  evaluateWordOrder,
  isOperatorToken,
  normalizeWordToken,
  scoreWordItem,
  validateModule,
  wordBuilderSchema,
} from "../src";

const roas = { tokens: ["ROAS", "=", "Revenue", "÷", "Ad spend"] };

describe("word-builder schema", () => {
  it("applies defaults", () => {
    const cfg = wordBuilderSchema.parse({
      id: "w",
      type: "word-builder",
      content: { items: [{ prompt: "Build it", tokens: ["a", "b"] }] },
    });
    const item = cfg.content.items[0]!;
    expect(item.distractors).toEqual([]);
    expect(item.display).toBe("sentence");
    expect(cfg.behavior).toEqual({
      allowRetry: true,
      maxAttempts: 0,
      showExplanation: true,
      showCounter: true,
    });
  });

  it("rejects empty tokens, too few tokens, duplicate ids and mismatched alternatives", () => {
    const res = validateModule({
      id: "w",
      type: "word-builder",
      content: {
        items: [
          { id: "a", prompt: "1", tokens: ["one", "  "] },
          { id: "a", prompt: "2", tokens: ["only"] },
          {
            prompt: "3",
            tokens: ["Spend", "÷", "Conversions"],
            alternatives: [
              ["Conversions", "÷", "Spend"],
              ["Spend", "×", "Conversions"],
            ],
          },
        ],
      },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const messages = res.issues.map((i) => `${i.path}: ${i.message}`).join("\n");
    expect(messages).toMatch(/items\[0\]\.tokens\[1\]: tokens must not be empty/);
    expect(messages).toMatch(/items\[1\]\.tokens/);
    expect(messages).toMatch(/items\[1\]\.id: duplicate item id "a"/);
    expect(messages).toMatch(
      /items\[2\]\.alternatives\[1\]: alternatives must use exactly the same/,
    );
    expect(messages).not.toMatch(/alternatives\[0\]/);
  });

  it("accepts the built-in type in a lesson", () => {
    const res = validateModule({
      id: "w",
      type: "word-builder",
      content: { items: [{ prompt: "p", tokens: ["a", "b"], display: "formula" }] },
      behavior: { shuffleSeed: 4, showCounter: false },
    });
    expect(res.success).toBe(true);
  });
});

describe("evaluateWordOrder", () => {
  it("accepts the exact order", () => {
    const ev = evaluateWordOrder(roas, ["ROAS", "=", "Revenue", "÷", "Ad spend"]);
    expect(ev).toMatchObject({ correct: true, score: 1, correctCount: 5, prefix: 5 });
    expect(ev.positions).toEqual([true, true, true, true, true]);
  });

  it("marks positions and the correct prefix", () => {
    const ev = evaluateWordOrder(roas, ["ROAS", "=", "Ad spend", "÷", "Revenue"]);
    expect(ev.correct).toBe(false);
    expect(ev.positions).toEqual([true, true, false, true, false]);
    expect(ev.correctCount).toBe(3);
    expect(ev.prefix).toBe(2);
    expect(ev.score).toBeCloseTo(3 / 5);
  });

  it("treats distractors and missing tiles as wrong", () => {
    const short = evaluateWordOrder(roas, ["ROAS", "=", "Revenue"]);
    expect(short.correct).toBe(false);
    expect(short.positions).toEqual([true, true, true]);
    expect(short.score).toBeCloseTo(3 / 5);
    const extra = evaluateWordOrder(roas, ["ROAS", "=", "Revenue", "÷", "Ad spend", "Clicks"]);
    expect(extra.correct).toBe(false);
    expect(extra.positions.at(-1)).toBe(false);
    expect(extra.score).toBeCloseTo(5 / 6);
    expect(evaluateWordOrder(roas, []).score).toBe(0);
  });

  it("compares duplicate tokens by value, not identity", () => {
    const item = { tokens: ["the", "brief", "before", "the", "build"] };
    // Either "the" tile works in either slot.
    expect(evaluateWordOrder(item, ["the", "brief", "before", "the", "build"]).correct).toBe(true);
    const ev = evaluateWordOrder(item, ["the", "the", "brief", "before", "build"]);
    expect(ev.positions).toEqual([true, false, false, false, true]);
  });

  it("uses the best-matching accepted alternative", () => {
    const item = {
      tokens: ["Escalate", "early", "and", "bring", "a", "fix"],
      alternatives: [["Bring", "a", "fix", "and", "escalate", "early"]],
    };
    expect(evaluateWordOrder(item, ["Bring", "a", "fix", "and", "escalate", "early"]).correct).toBe(
      true,
    );
    const ev = evaluateWordOrder(item, ["Bring", "a", "fix", "and", "early", "escalate"]);
    expect(ev.correct).toBe(false);
    expect(ev.answer[0]).toBe("Bring");
    expect(ev.positions).toEqual([true, true, true, true, false, false]);
    expect(ev.prefix).toBe(4);
  });

  it("normalises whitespace but stays case-sensitive", () => {
    expect(normalizeWordToken("  Ad   spend ")).toBe("Ad spend");
    expect(evaluateWordOrder({ tokens: ["Ad  spend", "x"] }, [" Ad spend", "x"]).correct).toBe(
      true,
    );
    expect(evaluateWordOrder({ tokens: ["ROAS", "x"] }, ["roas", "x"]).correct).toBe(false);
    expect(acceptedWordOrders({ tokens: ["a ", "b"], alternatives: [["b", " a"]] })).toEqual([
      ["a", "b"],
      ["b", "a"],
    ]);
  });
});

describe("word tiles", () => {
  it("detects operator glyphs", () => {
    for (const op of ["=", "÷", "×", "+", "−", "-", " / "]) expect(isOperatorToken(op)).toBe(true);
    for (const word of ["ROAS", "Ad spend", "==", "x"]) expect(isOperatorToken(word)).toBe(false);
  });

  it("builds a deterministic bank with every token and distractor", () => {
    const item = { ...roas, distractors: ["Clicks", "×"] };
    const a = buildWordTiles(item, 7);
    const b = buildWordTiles(item, 7);
    expect(a).toEqual(b);
    expect(a.map((t) => t.text).sort()).toEqual(
      ["ROAS", "=", "Revenue", "÷", "Ad spend", "Clicks", "×"].sort(),
    );
    expect(new Set(a.map((t) => t.id)).size).toBe(7);
    expect(
      a
        .filter((t) => t.distractor)
        .map((t) => t.text)
        .sort(),
    ).toEqual(["Clicks", "×"]);
  });

  it("never reads as the answer from left to right", () => {
    const item = { tokens: ["a", "b"], alternatives: [] as string[][] };
    for (let seed = 0; seed < 40; seed++) {
      const order = buildWordTiles(item, seed)
        .filter((t) => !t.distractor)
        .map((t) => t.text);
      expect(order).toEqual(["b", "a"]);
    }
  });
});

describe("scoreWordItem", () => {
  it("decays per attempt and gives half partial credit when unsolved", () => {
    expect(scoreWordItem({ correct: true, attempts: 1, lastScore: 1 })).toBe(1);
    expect(scoreWordItem({ correct: true, attempts: 2, lastScore: 1 })).toBe(0.75);
    expect(scoreWordItem({ correct: true, attempts: 5, lastScore: 1 })).toBe(0.5);
    expect(scoreWordItem({ correct: false, attempts: 3, lastScore: 0.6 })).toBeCloseTo(0.3);
    expect(scoreWordItem({ correct: false, attempts: 1, lastScore: 0 })).toBe(0);
  });
});
