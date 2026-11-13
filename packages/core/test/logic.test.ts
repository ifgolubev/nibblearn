import { describe, expect, it } from "vitest";
import {
  buildWordBank,
  chooseScenario,
  computeOutputs,
  createScriptedProvider,
  evaluateCategorySort,
  evaluateChoice,
  evaluateFillBlanks,
  evaluateSequence,
  findAllScore,
  matchingScore,
  moveItem,
  normalizeAnswer,
  parseTemplate,
  scenarioMaxPoints,
  scenarioScore,
  shuffle,
  shuffleDerangement,
  startScenario,
  summarizeConversation,
  unreachableNodes,
  withOptionIds,
  type BranchingScenarioConfig,
  type ConversationConfig,
  branchingScenarioSchema,
  conversationSchema,
  whatIfSimulatorSchema,
  parseInlineMarkup,
  splitParagraphs,
} from "../src";

describe("choice evaluation", () => {
  const q = {
    prompt: "?",
    options: [
      { text: "a", correct: true },
      { text: "b", correct: true },
      { text: "c", correct: false },
    ],
  } as never;
  const opts = withOptionIds(q);
  it("scores exact matches", () => {
    const r = evaluateChoice(opts, [opts[0]!.id, opts[1]!.id]);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1);
  });
  it("gives partial credit and penalises wrong picks", () => {
    expect(evaluateChoice(opts, [opts[0]!.id]).score).toBe(0.5);
    expect(evaluateChoice(opts, [opts[0]!.id, opts[2]!.id]).score).toBe(0);
    expect(evaluateChoice(opts, [opts[0]!.id], { partialCredit: false }).score).toBe(0);
  });
});

describe("sequence", () => {
  it("evaluates positions", () => {
    const r = evaluateSequence(["a", "b", "c"], ["a", "c", "b"]);
    expect(r.correct).toBe(false);
    expect(r.positions).toEqual([true, false, false]);
    expect(r.score).toBeCloseTo(1 / 3);
    expect(evaluateSequence(["a", "b"], ["a", "b"]).correct).toBe(true);
  });
  it("moves items", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("category sort", () => {
  it("evaluates assignments", () => {
    const items = [
      { id: "1", text: "x", categoryId: "a" },
      { id: "2", text: "y", categoryId: "b" },
    ];
    const r = evaluateCategorySort(items, { "1": "a" });
    expect(r.correctCount).toBe(1);
    expect(r.unassigned).toBe(1);
    expect(r.correct).toBe(false);
  });
});

describe("fill blanks", () => {
  it("parses templates and evaluates leniently", () => {
    expect(parseTemplate("ROAS = Revenue / {{spend}}.")).toEqual([
      { kind: "text", value: "ROAS = Revenue / " },
      { kind: "blank", id: "spend" },
      { kind: "text", value: "." },
    ]);
    const blanks = [{ id: "spend", answers: ["Ad spend", "spend"] }];
    expect(evaluateFillBlanks(blanks, { spend: "ad spend." }).correct).toBe(true);
    expect(evaluateFillBlanks(blanks, { spend: "Ad Spend" }, { caseSensitive: true }).correct).toBe(
      false,
    );
    expect(evaluateFillBlanks(blanks, {}).score).toBe(0);
    expect(normalizeAnswer("  “Hello”, World! ")).toBe("hello world");
  });
  it("builds a word bank", () => {
    const bank = buildWordBank([{ id: "a", answers: ["one"] }], ["two"], { shuffle: false });
    expect(bank.map((b) => b.text)).toEqual(["one", "two"]);
  });
});

describe("scenario", () => {
  const cfg = branchingScenarioSchema.parse({
    id: "s",
    type: "branching-scenario",
    content: {
      start: "a",
      nodes: [
        {
          id: "a",
          text: "?",
          choices: [
            { text: "good", next: "b", points: 10, quality: "good" },
            { text: "bad", next: "fail", points: -5, quality: "poor" },
          ],
        },
        { id: "b", text: "?", choices: [{ text: "finish", next: "win", points: 5 }] },
        { id: "win", kind: "ending", text: "yay", outcome: "success" },
        { id: "fail", kind: "ending", text: "nope", outcome: "failure" },
        { id: "orphan", kind: "ending", text: "unreachable" },
      ],
    },
  }) as BranchingScenarioConfig;

  it("navigates and scores", () => {
    let s = startScenario(cfg);
    expect(s.finished).toBe(false);
    s = chooseScenario(cfg, s, 0);
    expect(s.currentId).toBe("b");
    s = chooseScenario(cfg, s, 0);
    expect(s.finished).toBe(true);
    expect(s.points).toBe(15);
    expect(scenarioMaxPoints(cfg)).toBe(15);
    expect(scenarioScore(cfg, s)).toBe(1);
    expect(s.history).toHaveLength(2);
  });
  it("ignores invalid choices and finds unreachable nodes", () => {
    const s = startScenario(cfg);
    expect(chooseScenario(cfg, s, 9)).toBe(s);
    expect(unreachableNodes(cfg)).toEqual(["orphan"]);
  });
});

describe("conversation", () => {
  const cfg = conversationSchema.parse({
    id: "c",
    type: "conversation",
    content: {
      contact: { name: "Dana" },
      start: "n1",
      nodes: [
        {
          id: "n1",
          messages: [{ text: "Hi" }],
          responses: [
            { text: "Hello!", next: "end", tone: "Friendly", effectiveness: 0.9 },
            { text: "What.", next: "end", tone: "Blunt", effectiveness: 0.2 },
          ],
        },
        { id: "end", messages: [{ text: "Bye" }], summary: "done", outcome: "success" },
      ],
    },
  }) as ConversationConfig;
  it("runs the scripted provider", async () => {
    const p = createScriptedProvider(cfg);
    const t1 = await p.start();
    expect(t1.done).toBe(false);
    const t2 = await p.respond("n1-r0");
    expect(t2.done).toBe(true);
    expect(t2.node.id).toBe("end");
    expect(() => p.respond("nope")).toThrow();
  });
  it("summarises", () => {
    const s = summarizeConversation(
      [{ id: "x", text: "", next: "", effectiveness: 0.9, tone: "Friendly" }],
      undefined,
    );
    expect(s.score).toBe(0.9);
    expect(s.outcome).toBe("success");
    expect(s.tones).toEqual(["Friendly"]);
  });
});

describe("simulator", () => {
  it("computes outputs in order", () => {
    const cfg = whatIfSimulatorSchema.parse({
      id: "w",
      type: "what-if-simulator",
      content: {
        inputs: [
          { id: "spend", label: "Spend", min: 0, max: 1000, default: 500 },
          { id: "cpc", label: "CPC", min: 0.1, max: 5, default: 1, step: 0.1 },
        ],
        outputs: [
          { id: "clicks", label: "Clicks", formula: "spend / cpc" },
          { id: "cpa", label: "CPA", formula: "spend / (clicks * 0.02)" },
        ],
      },
    });
    const out = computeOutputs(cfg, { spend: 500, cpc: 1 });
    expect(out.clicks).toBe(500);
    expect(out.cpa).toBe(50);
  });
});

describe("scoring + utils", () => {
  it("scores find-all and matching", () => {
    expect(findAllScore(3, 3, 0)).toBe(1);
    expect(findAllScore(2, 3, 2)).toBeCloseTo(2 / 3 - 0.3);
    expect(matchingScore(5, 0)).toBe(1);
    expect(matchingScore(5, 10)).toBe(0);
  });
  it("shuffles deterministically", () => {
    const a = shuffle([1, 2, 3, 4, 5], 42);
    expect(shuffle([1, 2, 3, 4, 5], 42)).toEqual(a);
    expect(a.slice().sort()).toEqual([1, 2, 3, 4, 5]);
    const d = shuffleDerangement([1, 2], 1);
    expect(d).toEqual([2, 1]);
  });
  it("parses inline markup safely", () => {
    expect(parseInlineMarkup("a **b** `c`\nd <b>x</b>")).toEqual([
      { kind: "text", value: "a " },
      { kind: "bold", value: "b" },
      { kind: "text", value: " " },
      { kind: "code", value: "c" },
      { kind: "break" },
      { kind: "text", value: "d <b>x</b>" },
    ]);
    expect(splitParagraphs("one\n\ntwo\n  \nthree")).toEqual(["one", "two", "three"]);
  });
});
