import { describe, expect, it } from "vitest";
import {
  defineLesson,
  defineModule,
  LessonValidationError,
  SchemaRegistry,
  validateLesson,
  validateModule,
} from "../src";
import { z } from "zod";

const minimalLesson = {
  schemaVersion: 1,
  id: "demo",
  title: "Demo",
  modules: [
    {
      id: "intro",
      type: "story-cards",
      content: { cards: [{ title: "Hi", body: "Welcome" }] },
    },
    {
      id: "fc",
      type: "flashcards",
      content: { cards: [{ front: "CTR", back: "Click-through rate" }] },
    },
  ],
};

describe("validateLesson", () => {
  it("accepts a minimal lesson and applies defaults", () => {
    const res = validateLesson(minimalLesson);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.language).toBe("en");
    expect(res.data.completion.rule).toBe("all-modules");
    const fc = res.data.modules[1];
    expect(fc?.type).toBe("flashcards");
    if (fc?.type === "flashcards")
      expect((fc as { behavior: { requireMastery: boolean } }).behavior.requireMastery).toBe(true);
  });

  it("reports readable issues for unknown module types", () => {
    const res = validateLesson({
      ...minimalLesson,
      modules: [{ id: "x", type: "nope", content: {} }],
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.issues[0]?.path).toContain("modules[0]");
    expect(res.issues.map((i) => i.message).join("\n")).toMatch(/expected one of|does not match/);
  });

  it("reports duplicate module ids", () => {
    const res = validateLesson({
      ...minimalLesson,
      modules: [minimalLesson.modules[0], minimalLesson.modules[0]],
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.issues.some((i) => i.message.includes("duplicate module id"))).toBe(true);
  });

  it("points at the exact path of nested errors", () => {
    const res = validateLesson({
      ...minimalLesson,
      modules: [
        {
          id: "q",
          type: "choice-challenge",
          content: { questions: [{ prompt: "?", options: [{ text: "a" }, { text: "b" }] }] },
        },
      ],
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.issues[0]?.path).toBe("modules[0].content.questions[0].options");
    expect(res.issues[0]?.message).toMatch(/at least one correct option/);
  });

  it("defineLesson throws a readable error", () => {
    expect(() => defineLesson({ ...minimalLesson, modules: [] } as never)).toThrow(
      LessonValidationError,
    );
    try {
      defineLesson({ ...minimalLesson, title: "" } as never);
    } catch (e) {
      expect((e as Error).message).toMatch(/title/);
    }
  });

  it("supports custom module registries", () => {
    const registry = new SchemaRegistry().register({
      type: "poll",
      name: "Poll",
      description: "",
      category: "practice",
      schema: z.object({ id: z.string(), type: z.literal("poll"), question: z.string() }),
    });
    const ok = validateLesson(
      { ...minimalLesson, modules: [{ id: "p", type: "poll", question: "Hi?" }] },
      { registry },
    );
    expect(ok.success).toBe(true);
    const bad = validateLesson(
      { ...minimalLesson, modules: [{ id: "p", type: "poll" }] },
      { registry },
    );
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.issues[0]?.path).toBe("modules[0].question");
  });

  it("validateModule validates a single module", () => {
    expect(
      validateModule({ id: "a", type: "true-false", content: { statements: [] } }).success,
    ).toBe(false);
    expect(
      validateModule({
        id: "a",
        type: "true-false",
        content: { statements: [{ text: "x", isTrue: true }] },
      }).success,
    ).toBe(true);
  });
});

describe("module-specific validation", () => {
  it("detects broken scenario references", () => {
    const res = validateModule({
      id: "s",
      type: "branching-scenario",
      content: {
        start: "a",
        nodes: [
          { id: "a", text: "?", choices: [{ text: "go", next: "missing" }] },
          { id: "end", kind: "ending", text: "bye" },
        ],
      },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.issues[0]?.message).toMatch(/unknown node "missing"/);
  });

  it("detects template/blank mismatches", () => {
    const res = validateModule({
      id: "f",
      type: "fill-blanks",
      content: { template: "ROAS = Revenue / {{spend}}", blanks: [{ id: "cost", answers: ["x"] }] },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.issues.map((i) => i.message).join()).toMatch(/no blank with id "spend"/);
  });

  it("detects category mismatches and simulator formula errors", () => {
    expect(
      validateModule({
        id: "c",
        type: "category-sort",
        content: {
          categories: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
          items: [
            { id: "i1", text: "x", categoryId: "zzz" },
            { id: "i2", text: "y", categoryId: "a" },
          ],
        },
      }).success,
    ).toBe(false);
    const sim = validateModule({
      id: "w",
      type: "what-if-simulator",
      content: {
        inputs: [{ id: "spend", label: "Spend", min: 0, max: 100, default: 10 }],
        outputs: [{ id: "cpa", label: "CPA", formula: "spend / clicks" }],
      },
    });
    expect(sim.success).toBe(false);
    if (!sim.success) expect(sim.issues[0]?.message).toMatch(/unknown id "clicks"/);
  });
});

describe("defineModule", () => {
  it("validates, applies defaults and narrows the type", () => {
    const deck = defineModule({
      id: "deck",
      type: "flashcards",
      content: { cards: [{ front: "CTR", back: "Click-through rate" }] },
    });
    // Type-level check: `behavior` exists only on the narrowed FlashcardsConfig.
    const mastery: boolean = deck.behavior.requireMastery;
    expect(mastery).toBe(true);
    expect(deck.type).toBe("flashcards");
  });

  it("throws a readable error for invalid input", () => {
    expect(() =>
      defineModule({ id: "x", type: "flashcards", content: { cards: [] } } as never),
    ).toThrow(/content\.cards/);
  });
});

describe("untrusted-content hardening", () => {
  const lessonWith = (
    extra: Record<string, unknown>,
    modulePatch: Record<string, unknown> = {},
  ) => ({
    schemaVersion: 1,
    id: "x",
    title: "X",
    ...extra,
    modules: [
      {
        id: "m",
        type: "true-false",
        content: { statements: [{ text: "t", isTrue: true }] },
        ...modulePatch,
      },
    ],
  });

  it("accepts plain CSS colours and rejects url()/var()/injection in colour fields", async () => {
    const { isSafeCssColor } = await import("../src");
    for (const ok of [
      "#0ea5e9",
      "#fff",
      "rebeccapurple",
      "accent",
      "rgb(10 20 30 / 50%)",
      "hsl(210, 80%, 50%)",
      "oklch(0.7 0.1 250)",
    ])
      expect(isSafeCssColor(ok), ok).toBe(true);
    for (const bad of [
      "url(https://evil.example/t.gif)",
      "red; background: url(//evil.example)",
      "var(--x)",
      "image-set(url(x) 1x)",
      "rgb(url(x))",
      "expression(alert(1))",
      "",
    ])
      expect(isSafeCssColor(bad), bad).toBe(false);

    expect(validateLesson(lessonWith({ theme: { accent: "#0ea5e9" } })).success).toBe(true);
    expect(
      validateLesson(lessonWith({ theme: { accent: "url(https://evil.example/t.gif)" } })).success,
    ).toBe(false);
    expect(
      validateLesson(lessonWith({}, { appearance: { accent: "url(//evil.example)" } })).success,
    ).toBe(false);
    expect(
      validateLesson(lessonWith({ theme: { fontFamily: "Inter, 'Segoe UI', sans-serif" } }))
        .success,
    ).toBe(true);
    expect(
      validateLesson(lessonWith({ theme: { fontFamily: "x; } body { display:none" } })).success,
    ).toBe(false);
    expect(
      validateModule({
        id: "c",
        type: "category-sort",
        content: {
          categories: [
            { id: "a", label: "A", color: "url(https://evil.example)" },
            { id: "b", label: "B" },
          ],
          items: [
            { id: "1", text: "x", categoryId: "a" },
            { id: "2", text: "y", categoryId: "b" },
          ],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects script-capable image URLs and accepts normal ones", async () => {
    const { isSafeImageSrc } = await import("../src");
    for (const ok of [
      "https://cdn.example/a.png",
      "/img/a.png",
      "./a.png",
      "a.png",
      "//cdn.example/a.png",
      "blob:https://x/1",
      "data:image/png;base64,AAAA",
      "data:image/svg+xml;utf8,<svg/>",
    ])
      expect(isSafeImageSrc(ok), ok).toBe(true);
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "vbscript:x",
      "data:text/html,<script>1</script>",
      "file:///etc/passwd",
      " ",
      "java\tscript:alert(1)",
    ])
      expect(isSafeImageSrc(bad), bad).toBe(false);
    const res = validateModule({
      id: "h",
      type: "hotspot-explorer",
      content: {
        image: { src: "javascript:alert(1)", alt: "" },
        hotspots: [{ id: "a", x: 1, y: 1, label: "A", description: "d" }],
      },
    });
    expect(res.success).toBe(false);
  });
});
