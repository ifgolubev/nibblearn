import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SchemaRegistry, migrateLesson, migrateModule, validateModule } from "../src";
import * as examples from "../../../examples/src";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const pollRegistry = new SchemaRegistry([
  {
    type: "poll",
    name: "Poll",
    description: "Test module",
    category: "practice",
    schema: z.object({
      id: z.string(),
      type: z.literal("poll"),
      schemaVersion: z.number().optional(),
      question: z.string(),
      choices: z.array(z.object({ label: z.string() })),
    }),
    version: 3,
    migrations: {
      // v1 stored `prompt` and `options: string[]`.
      1: (c) => {
        const { prompt, ...rest } = c;
        return { ...rest, question: prompt };
      },
      2: (c) => ({
        ...c,
        choices: (c.options as string[]).map((label) => ({ label })),
        options: undefined,
      }),
    },
  },
]);

describe("migrateModule", () => {
  it("applies migrations in order and stamps the current version", () => {
    const input = deepFreeze({
      id: "p",
      type: "poll",
      prompt: "Best day?",
      options: ["Mon", "Fri"],
    });
    const res = migrateModule(input, { registry: pollRegistry });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res).toMatchObject({ from: 1, to: 3, changed: true });
    expect(res.data).toMatchObject({
      schemaVersion: 3,
      question: "Best day?",
      choices: [{ label: "Mon" }, { label: "Fri" }],
    });
    expect(validateModule(res.data, { registry: pollRegistry }).success).toBe(true);
  });

  it("starts from the stored version", () => {
    const res = migrateModule(
      { id: "p", type: "poll", schemaVersion: 2, question: "Q", options: ["a"] },
      { registry: pollRegistry },
    );
    expect(res.success && res.from).toBe(2);
    expect(res.success && res.data.choices).toEqual([{ label: "a" }]);
  });

  it("returns the same object when the config is current", () => {
    const input = { id: "p", type: "poll", schemaVersion: 3, question: "Q", choices: [] };
    const res = migrateModule(input, { registry: pollRegistry });
    expect(res.success && res.data).toBe(input);
    expect(res.success && res.changed).toBe(false);
  });

  it("reports a missing migration", () => {
    const registry = new SchemaRegistry([
      { ...pollRegistry.get("poll")!, migrations: { 1: (c) => c } },
    ]);
    const res = migrateModule({ id: "p", type: "poll" }, { registry });
    expect(res.success).toBe(false);
    expect(!res.success && res.issues[0]!.message).toMatch(/no migration from version 2/);
  });

  it("rejects configs from a newer library", () => {
    const res = migrateModule(
      { id: "p", type: "poll", schemaVersion: 9 },
      { registry: pollRegistry },
    );
    expect(!res.success && res.issues[0]!.message).toMatch(/newer schema version \(9\)/);
  });

  it.each([0, 1.5, "2", -1, null])("rejects schemaVersion %p", (schemaVersion) => {
    const res = migrateModule({ id: "p", type: "poll", schemaVersion }, { registry: pollRegistry });
    expect(!res.success && res.issues[0]!.path).toBe("schemaVersion");
  });

  it("rejects unknown and missing types", () => {
    expect(migrateModule({ id: "x", type: "nope" }).success).toBe(false);
    expect(migrateModule({ id: "x" }).success).toBe(false);
    expect(migrateModule("text").success).toBe(false);
    expect(migrateModule(null).success).toBe(false);
  });

  it("ignores a migrations table inherited from the prototype", () => {
    const migrations = Object.create({ 1: () => ({}) }) as Record<number, never>;
    const registry = new SchemaRegistry([{ ...pollRegistry.get("poll")!, version: 2, migrations }]);
    expect(migrateModule({ id: "p", type: "poll" }, { registry }).success).toBe(false);
  });

  const demos = Object.entries(examples as Record<string, { type?: unknown }>).filter(
    ([, v]) => v && typeof v.type === "string",
  );
  it.each(demos)("leaves the built-in demo %s untouched", (_name, demo) => {
    const res = migrateModule(demo);
    expect(res.success && res.changed).toBe(false);
    expect(res.success && res.data).toBe(demo);
  });

  it("accepts schemaVersion 1 on built-in modules", () => {
    const res = validateModule({ ...examples.trueFalseDemo, schemaVersion: 1 });
    expect(res.success).toBe(true);
  });
});

describe("migrateLesson", () => {
  const lesson = {
    schemaVersion: 1,
    id: "l",
    title: "L",
    modules: [
      { id: "a", type: "poll", prompt: "Q", options: ["x"] },
      { id: "b", type: "poll", schemaVersion: 3, question: "Q", choices: [] },
    ],
  };

  it("migrates each module and keeps the lesson version", () => {
    const input = deepFreeze(structuredClone(lesson));
    const res = migrateLesson(input, { registry: pollRegistry });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.changed).toBe(true);
    expect(res.data.schemaVersion).toBe(1);
    const modules = res.data.modules as Record<string, unknown>[];
    expect(modules[0]).toMatchObject({ schemaVersion: 3, question: "Q" });
    // The current module is passed through as the same object.
    expect(modules[1]).toBe(input.modules[1]);
  });

  it("returns the input when nothing changes", () => {
    const res = migrateLesson(examples.marketingMetricsLesson);
    expect(res.success && res.data).toBe(examples.marketingMetricsLesson);
  });

  it("prefixes issues with the module index", () => {
    const res = migrateLesson({ ...lesson, modules: [{ id: "z", type: "nope" }] });
    expect(!res.success && res.issues[0]!.path).toBe("modules[0].type");
  });

  it("rejects non-lessons", () => {
    expect(migrateLesson(null).success).toBe(false);
    expect(migrateLesson({ modules: "x" }).success).toBe(false);
  });
});
