import { describe, expect, it } from "vitest";
import {
  builtInModuleTypes,
  chooseScenario,
  gradableModuleTypes,
  gradeModule,
  isGradable,
  optimalAllocation,
  responsesOf,
  startScenario,
  validateModule,
  withOptionIds,
  type BuiltInModuleType,
  type ModuleAnswer,
  type ModuleConfig,
} from "../src";
import { createExample } from "../src/examples";

type Cfg<T extends BuiltInModuleType> = Extract<ModuleConfig, { type: T }>;

function example<T extends BuiltInModuleType>(type: T): Cfg<T> {
  const res = validateModule(createExample(type));
  if (!res.success) throw new Error(`example for ${type} is invalid`);
  return res.data as Cfg<T>;
}

/** A response that gets everything right at the first attempt. */
function perfect(type: string): ModuleAnswer[] {
  switch (type) {
    case "choice-challenge":
      return example("choice-challenge").content.questions.map((q, itemIndex) => ({
        itemIndex,
        response: withOptionIds(q, itemIndex)
          .filter((o) => o.correct)
          .map((o) => o.id),
      }));
    case "true-false":
      return example("true-false").content.statements.map((s, itemIndex) => ({
        itemIndex,
        response: s.isTrue,
      }));
    case "sequence-builder":
      return [{ response: example("sequence-builder").content.items.map((i) => i.id) }];
    case "category-sort":
      return [
        {
          response: Object.fromEntries(
            example("category-sort").content.items.map((i) => [i.id, i.categoryId]),
          ),
        },
      ];
    case "priority-matrix":
      return [
        {
          response: Object.fromEntries(
            example("priority-matrix").content.items.map((i) => [i.id, i.quadrantId]),
          ),
        },
      ];
    case "label-diagram":
      return [
        {
          response: Object.fromEntries(
            example("label-diagram").content.targets.map((t) => [t.id, t.label]),
          ),
        },
      ];
    case "fill-blanks":
      return [
        {
          response: Object.fromEntries(
            example("fill-blanks").content.blanks.map((b) => [b.id, b.answers[0]]),
          ),
        },
      ];
    case "inbox-triage":
      return example("inbox-triage").content.messages.map((m) => ({
        itemId: m.id,
        response: m.correctAction,
      }));
    case "word-builder":
      return example("word-builder").content.items.map((item, itemIndex) => ({
        itemIndex,
        response: item.tokens,
      }));
    case "estimate":
      return example("estimate").content.questions.map((q, itemIndex) => ({
        itemIndex,
        response: q.answer,
      }));
    case "match-pairs":
      return example("match-pairs").content.pairs.map((p, i) => ({
        itemId: p.id ?? `pair-${i}`,
        response: p.id ?? `pair-${i}`,
      }));
    case "spot-the-mistake":
      return [{ response: example("spot-the-mistake").content.mistakes.map((m) => m.targetId) }];
    case "branching-scenario": {
      const config = example("branching-scenario");
      const nodes = new Map(config.content.nodes.map((n) => [n.id, n]));
      const answers: ModuleAnswer[] = [];
      let state = startScenario(config);
      while (!state.finished) {
        const choices = nodes.get(state.currentId)!.choices;
        const best = choices.indexOf([...choices].sort((a, b) => b.points - a.points)[0]!);
        answers.push({ itemId: state.currentId, response: best });
        state = chooseScenario(config, state, best);
      }
      return answers;
    }
    case "conversation": {
      const config = example("conversation");
      const nodes = new Map(config.content.nodes.map((n) => [n.id, n]));
      const answers: ModuleAnswer[] = [];
      let id = config.content.start;
      while (nodes.get(id)!.responses.length > 0 && answers.length < config.behavior.maxSteps) {
        const best = [...responsesOf(nodes.get(id)!)].sort(
          (a, b) => b.effectiveness - a.effectiveness,
        )[0]!;
        answers.push({ itemId: id, response: best.id });
        id = best.next;
      }
      return answers;
    }
    case "budget-allocator":
      return [{ response: optimalAllocation(example("budget-allocator")) }];
    default:
      throw new Error(`no perfect response for ${type}`);
  }
}

const grade = (type: BuiltInModuleType, answers: ModuleAnswer[]) =>
  gradeModule(createExample(type), { answers });

describe("gradeModule", () => {
  it.each(gradableModuleTypes)("%s: a faultless response is complete and passes", (type) => {
    const res = grade(type as BuiltInModuleType, perfect(type));
    expect(res.issues).toEqual([]);
    expect(res.success && res.grade.complete).toBe(true);
    expect(res.success && res.grade.passed).toBe(true);
    const score = res.success ? res.grade.score : undefined;
    // Scenarios and conversations score the path taken, which the greedy walk may not maximise.
    if (type === "branching-scenario" || type === "conversation")
      expect(score).toBeGreaterThan(0.5);
    else expect(score).toBeCloseTo(1, 6);
    if (res.success && res.grade.total !== undefined)
      expect(res.grade.correct).toBe(res.grade.total);
  });

  it.each(gradableModuleTypes)("%s: no answers is incomplete and does not pass", (type) => {
    const res = grade(type as BuiltInModuleType, []);
    expect(res.success && res.grade.complete).toBe(false);
    expect(res.success && res.grade.passed).toBe(false);
  });

  it("knows which built-in types have answers to grade", () => {
    for (const type of gradableModuleTypes) expect(builtInModuleTypes).toContain(type);
    expect(isGradable("choice-challenge")).toBe(true);
    expect(isGradable("flashcards")).toBe(false);
    const res = gradeModule(createExample("flashcards"), { answers: [] });
    expect(res.success).toBe(false);
    expect(!res.success && res.reason).toBe("not-gradable");
  });

  it("rejects an invalid config and a malformed response without throwing", () => {
    const bad = gradeModule({ type: "choice-challenge" }, { answers: [] });
    expect(!bad.success && bad.reason).toBe("invalid-config");
    for (const response of [null, "x", {}, { answers: "x" }, { answers: [null] }]) {
      const res = gradeModule(createExample("choice-challenge"), response);
      expect(!res.success && res.reason).toBe("invalid-response");
    }
    const tooMany = { answers: Array.from({ length: 2001 }, () => ({ itemIndex: 0 })) };
    const res = gradeModule(createExample("choice-challenge"), tooMany);
    expect(!res.success && res.reason).toBe("invalid-response");
  });

  it("says which answer does not fit the config", () => {
    const unknownOption = grade("choice-challenge", [{ itemIndex: 0, response: ["nope"] }]);
    expect(!unknownOption.success && unknownOption.issues[0]?.path).toBe("answers[0]");
    const outOfRange = grade("choice-challenge", [{ itemIndex: 99, response: [] }]);
    expect(!outOfRange.success && outOfRange.reason).toBe("invalid-response");
    const wrongType = grade("true-false", [{ itemIndex: 0, response: "true" }]);
    expect(!wrongType.success && wrongType.reason).toBe("invalid-response");
    const offScale = grade("estimate", [{ itemIndex: 0, response: 1e12 }]);
    expect(!offScale.success && offScale.reason).toBe("invalid-response");
    const jump = grade("branching-scenario", [{ itemId: "no-such-node", response: 0 }]);
    expect(!jump.success && jump.reason).toBe("invalid-response");
  });

  it("choice: a retry costs credit, unless answers are collected for the host", () => {
    const config = example("choice-challenge");
    const [first, ...rest] = perfect("choice-challenge");
    const options = withOptionIds(config.content.questions[0]!, 0);
    const wrong = { itemIndex: 0, response: [options.find((o) => !o.correct)!.id] };
    const retried = gradeModule(config, { answers: [wrong, first!, ...rest] });
    const total = config.content.questions.length;
    expect(retried.success && retried.grade.score).toBeCloseTo((total - 0.25) / total, 6);
    expect(retried.success && retried.grade.items[0]).toMatchObject({ correct: true, attempts: 2 });

    const external = { ...config, behavior: { ...config.behavior, evaluation: "external" } };
    const changed = gradeModule(external, { answers: [wrong, first!, ...rest] });
    expect(changed.success && changed.grade.score).toBeCloseTo(1, 6);
  });

  it("sorting: a wrong first check keeps its fraction unless everything ends up right", () => {
    const config = example("category-sort");
    const right = perfect("category-sort")[0]!.response as Record<string, string>;
    const [firstId] = Object.keys(right);
    const other = config.content.categories.find((c) => c.id !== right[firstId!])!.id;
    const wrong = { ...right, [firstId!]: other };
    const n = config.content.items.length;
    const gaveUp = gradeModule(config, { answers: [{ response: wrong }] });
    expect(gaveUp.success && gaveUp.grade.score).toBeCloseTo((n - 1) / n, 6);
    const fixed = gradeModule(config, { answers: [{ response: wrong }, { response: right }] });
    expect(fixed.success && fixed.grade.score).toBeCloseTo(0.75, 6);
  });

  it("match pairs: mistakes lower the score and unmatched pairs leave it incomplete", () => {
    const answers = perfect("match-pairs");
    const miss = { itemId: answers[0]!.itemId, response: answers[1]!.itemId };
    const withMiss = grade("match-pairs", [miss, ...answers]);
    expect(withMiss.success && withMiss.grade.score).toBeLessThan(1);
    expect(withMiss.success && withMiss.grade.complete).toBe(true);
    const partial = grade("match-pairs", answers.slice(1));
    expect(partial.success && partial.grade.complete).toBe(false);
  });

  it("budget: shares must respect the limits and add up to 100", () => {
    const optimal = optimalAllocation(example("budget-allocator"));
    const [id] = Object.keys(optimal);
    const inflated = grade("budget-allocator", [{ response: { ...optimal, [id!]: 100 } }]);
    expect(!inflated.success && inflated.reason).toBe("invalid-response");
  });

  it("ignores keys a response should not have", () => {
    const right = perfect("category-sort")[0]!.response as Record<string, string>;
    const hostile = JSON.parse(
      JSON.stringify({ answers: [{ response: { ...right, extra: "x" } }] }).replace(
        '"extra"',
        '"__proto__"',
      ),
    ) as unknown;
    const res = gradeModule(createExample("category-sort"), hostile);
    expect(res.success && res.grade.score).toBeCloseTo(1, 6);
    expect(({} as Record<string, unknown>).extra).toBeUndefined();
  });

  it("applies the pass threshold and custom graders", () => {
    const config = { ...example("true-false"), scoring: { weight: 1, passThreshold: 1 } };
    const answers = perfect("true-false");
    const flipped = [{ ...answers[0]!, response: !answers[0]!.response }, ...answers.slice(1)];
    const res = gradeModule(config, { answers: flipped });
    expect(res.success && res.grade.complete).toBe(true);
    expect(res.success && res.grade.passed).toBe(false);

    // No threshold set: the default of 0.7 applies, as in `moduleResultPassed()`.
    const unset = gradeModule(example("true-false"), { answers: flipped });
    const n = answers.length;
    expect(unset.success && unset.grade.passed).toBe((n - 1) / n >= 0.7);

    const custom = gradeModule(
      createExample("flashcards"),
      { answers: [{ response: "any" }] },
      {
        graders: {
          flashcards: (_config, given) => ({
            score: 1,
            complete: true,
            attempts: given.length,
            items: [],
          }),
        },
      },
    );
    expect(custom.success && custom.grade).toMatchObject({ score: 1, passed: true, attempts: 1 });
  });
});

describe("an unfinished activity", () => {
  it.each(gradableModuleTypes)("%s: scores 0 until the response is complete", (type) => {
    const answers = perfect(type);
    // Nothing answered, and (where there are several answers) all but the last one.
    for (const given of [[], ...(answers.length > 1 ? [answers.slice(0, -1)] : [])]) {
      const res = gradeModule(createExample(type as BuiltInModuleType), { answers: given });
      if (!res.success) throw new Error(`${type}: ${res.reason}`);
      if (res.grade.complete) continue;
      expect(res.grade.score ?? 0).toBe(0);
      expect(res.grade.passed).toBe(false);
    }
  });
});

describe("version", () => {
  it("is the package version", async () => {
    const { version } = await import("../src");
    const { readFileSync } = await import("node:fs");
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    };
    expect(version).toBe(pkg.version);
  });
});
