import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  SchemaRegistry,
  builtInModuleDefinitions,
  collectText,
  lessonToText,
  moduleToText,
  moduleToTextNodes,
  stripMarkup,
} from "../src";
import { moduleExamples } from "../src/examples";
import * as examples from "../../../examples/src";

const demos = Object.entries(moduleExamples);
const full = { includeAnswers: true, includeFeedback: true } as const;

describe("moduleToText", () => {
  it.each(demos)("%s: text and markdown snapshots", (_type, demo) => {
    const text = moduleToText(demo, full);
    const markdown = moduleToText(demo, { ...full, format: "markdown" });
    for (const out of [text, markdown, moduleToText(demo)]) {
      expect(out).not.toMatch(/undefined|\[object Object\]|data:image|NaN/);
      expect(out.trim().length).toBeGreaterThan(0);
    }
    expect(text).toMatchSnapshot("text");
    expect(markdown).toMatchSnapshot("markdown");
  });

  it.each(demos)("%s: keeps every learner-facing string", (type, demo) => {
    const def = builtInModuleDefinitions.find((d) => d.type === type)!;
    const parsed = def.schema.parse(demo);
    const out = stripMarkup(moduleToText(demo, full)).replace(/\s+/g, " ");
    const missing = collectText(parsed, { includeFeedback: true })
      .map((s) => stripMarkup(s).replace(/\s+/g, " ").trim())
      .filter((s) => !out.includes(s));
    expect(missing).toEqual([]);
  });

  it("hides answers and feedback unless asked", () => {
    const quiz = moduleExamples["choice-challenge"];
    const plain = moduleToText(quiz);
    expect(plain).not.toContain("(correct)");
    expect(plain).not.toContain("Explanation");
    expect(moduleToText(quiz, { includeAnswers: true })).toContain("(correct)");
    expect(moduleToText(quiz, { format: "markdown" })).not.toContain("✓");

    const tf = moduleToText(moduleExamples["true-false"]);
    expect(tf).not.toMatch(/Answer: (True|False)/);
    expect(moduleToText(moduleExamples["true-false"], { includeAnswers: true })).toMatch(
      /Answer: (True|False)/,
    );

    const blanks = moduleToText(moduleExamples["fill-blanks"]);
    expect(blanks).toContain("____");
  });

  it("strips markup in text and keeps it in markdown", () => {
    const config = {
      id: "f",
      type: "flashcards",
      title: "Deck",
      content: { cards: [{ front: "**CTR**", back: "Clicks *divided* by impressions" }] },
    };
    expect(moduleToText(config)).toBe("Deck\n\nCTR\n\nClicks divided by impressions");
    expect(moduleToText(config, { format: "markdown" })).toBe(
      "## Deck\n\n### **CTR**\n\nClicks *divided* by impressions",
    );
  });

  it("falls back to collecting strings for invalid configs and unknown types", () => {
    expect(
      moduleToText({ type: "nope", title: "Custom", items: [{ label: "A" }, { src: "x" }] }),
    ).toBe("Custom\n\nA");
    expect(moduleToText({ type: "flashcards", title: "Broken" })).toBe("Broken");
    expect(moduleToText(null)).toBe("");
    expect(moduleToText("text")).toBe("");
  });

  it("uses a custom module's toText", () => {
    const registry = new SchemaRegistry([
      {
        type: "poll",
        name: "Poll",
        description: "",
        category: "practice",
        schema: z.object({ id: z.string(), type: z.literal("poll"), question: z.string() }),
        toText: (c) => [
          { kind: "paragraph", text: `Poll: ${(c as { question: string }).question}` },
        ],
      },
    ]);
    expect(moduleToText({ id: "p", type: "poll", question: "Tea?" }, { registry })).toBe(
      "Poll: Tea?",
    );
    expect(moduleToTextNodes({ id: "p", type: "poll", question: "Tea?" }, { registry })).toEqual([
      { kind: "paragraph", text: "Poll: Tea?" },
    ]);
  });
});

describe("lessonToText", () => {
  it("renders the title, objectives and modules in order", () => {
    const lesson = examples.marketingMetricsLesson;
    const out = lessonToText(lesson, { format: "markdown" });
    expect(out.startsWith(`# ${lesson.title}`)).toBe(true);
    let last = -1;
    for (const m of lesson.modules) {
      if (!("title" in m) || !m.title) continue;
      const at = out.indexOf(`## ${m.title}`);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it("returns an empty string for non-lessons", () => {
    expect(lessonToText(null)).toBe("");
  });
});

describe("answers stay hidden by default", () => {
  it("match-pairs does not pair the sides", () => {
    const c = moduleExamples["match-pairs"];
    const text = moduleToText(c, { includeFeedback: true });
    for (const p of c.content.pairs) expect(text).not.toContain(`${p.left} — ${p.right}`);
    expect(text).toContain(c.content.pairs[0]!.right);
  });

  it("sequence-builder and label-diagram list items alphabetically", () => {
    const seq = moduleExamples["sequence-builder"];
    const steps = seq.content.items.map((i) => i.text);
    const text = moduleToText(seq);
    const positions = steps.map((s) => text.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const shown = [...steps].sort((a, b) => text.indexOf(a) - text.indexOf(b));
    expect(shown).toEqual([...steps].sort((a, b) => (a < b ? -1 : 1)));
    for (const i of seq.content.items) if (i.description) expect(text).not.toContain(i.description);

    const diagram = moduleExamples["label-diagram"];
    const labels = diagram.content.targets.map((t) => t.label);
    const dtext = moduleToText(diagram);
    const order = [...labels].sort((a, b) => dtext.indexOf(a) - dtext.indexOf(b));
    expect(order).toEqual([...labels].sort((a, b) => (a < b ? -1 : 1)));
  });
});

describe("empty labels", () => {
  it("never produce empty list items or a leading colon", () => {
    const c = structuredClone(moduleExamples["process-explorer"]);
    c.content.stages[0]!.title = "";
    const text = moduleToText(c, { includeFeedback: true, includeAnswers: true });
    expect(text).not.toMatch(/^- $/m);
    expect(text).not.toMatch(/^: /m);
  });
});
