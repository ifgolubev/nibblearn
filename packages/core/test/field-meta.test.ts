import { describe, expect, it } from "vitest";
import {
  builtInModuleTypes,
  getLessonJsonSchema,
  getModuleJsonSchema,
  humanizeKey,
  singular,
} from "../src";

type Node = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Every property of a JSON Schema, with its path. */
function* properties(node: Node, path: string[] = []): Generator<[string, Node]> {
  for (const v of [...(node.oneOf ?? []), ...(node.anyOf ?? [])]) yield* properties(v, path);
  for (const [k, child] of Object.entries<Node>(node.properties ?? {})) {
    yield [[...path, k].join("."), child];
    yield* properties(child, [...path, k]);
  }
  if (node.items) yield* properties(node.items, [...path, "[]"]);
}

describe("field metadata", () => {
  it.each(builtInModuleTypes)("%s: every visible field has a title", (type) => {
    const missing: string[] = [];
    for (const [path, node] of properties(getModuleJsonSchema(type)!)) {
      if (node["x-ui"]?.widget === "hidden" || node.const !== undefined) continue;
      if (typeof node.title !== "string" || !node.title.trim()) missing.push(path);
    }
    expect(missing).toEqual([]);
  });

  it("uses source comments as descriptions and adds widget hints", () => {
    const tf = getModuleJsonSchema("true-false") as Node;
    const statement = tf.properties.content.properties.statements;
    expect(statement["x-ui"]).toMatchObject({ itemName: "statement", itemLabel: "text" });
    expect(statement.items.properties.isTrue.title).toBe("Statement is true");
    expect(statement.items.properties.isTrue["x-ui"].widget).toBe("switch");
    expect(statement.items.properties.image["x-ui"].widget).toBe("image");
    expect(tf.properties.behavior.properties.swipe.description).toMatch(/swipe gestures/);
    expect(tf.properties.behavior["x-ui"].group).toBe("behavior");
    expect(tf.properties.id["x-ui"].widget).toBe("id");
    expect(tf.properties.meta["x-ui"].widget).toBe("hidden");
    expect(tf.properties.appearance.properties.accent["x-ui"].widget).toBe("color");
    expect(tf["x-icon"]).toBe("toggle-left");
  });

  it("annotates the lesson settings", () => {
    const lesson = getLessonJsonSchema() as Node;
    expect(lesson.properties.theme.properties.mode["x-ui"].widget).toBe("select");
    expect(lesson.properties.title.title).toBe("Title");
  });

  it("humanises keys and singularises list names", () => {
    expect(humanizeKey("pairsPerRound")).toBe("Pairs per round");
    expect(humanizeKey("isTrue")).toBe("Statement is true");
    expect(singular("categories")).toBe("category");
    expect(singular("boxes")).toBe("box");
    expect(singular("cards")).toBe("card");
    expect(singular("class")).toBe("class");
  });
});

describe("field docs (generated)", () => {
  it("are keyed by module type, and every built-in type has docs", async () => {
    const { fieldDocs } = await import("../src/schema/field-docs.generated");
    expect(Object.keys(fieldDocs.byType).sort()).toEqual([...builtInModuleTypes].sort());
  });

  it("give each content block its own field descriptions", () => {
    const text = (type: string, path: string) =>
      [...properties(getModuleJsonSchema(type)!)].find(([p]) => p === path)?.[1].description;
    expect(text("callout", "content.text")).toMatch(/callout text/i);
    expect(text("accordion", "content.items.[].text")).toMatch(/panel text/i);
    expect(text("tabs", "content.tabs.[].text")).toMatch(/tab panel/i);
    expect(text("carousel", "content.slides.[].text")).toMatch(/slide text/i);
    expect(text("columns", "content.columns.[].text")).toMatch(/column text/i);
  });
});
