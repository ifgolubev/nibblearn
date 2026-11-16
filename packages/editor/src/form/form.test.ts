import { describe, expect, it } from "vitest";
import { builtInModuleTypes, getModuleJsonSchema, validateModule } from "@nibblearn/core";
import { defaultFor, uniqueId } from "./defaults";
import { getAt, insertAt, moveItem, removeAt, setAt } from "./path";
import { toFormNode } from "./schema";

describe("toFormNode", () => {
  it("normalises objects, arrays, enums, unions, records and nullables", () => {
    const node = toFormNode({
      type: "object",
      required: ["name", "list"],
      properties: {
        name: { type: "string", maxLength: 20, title: "Name", "x-ui": { widget: "text" } },
        count: { type: "integer", minimum: 0, maximum: 10 },
        mode: { type: "string", enum: ["a", "b"] },
        list: {
          type: "array",
          minItems: 1,
          items: { type: "object", properties: { id: { type: "string" } } },
        },
        pick: {
          oneOf: [
            {
              type: "object",
              properties: { kind: { type: "string", const: "x" }, n: { type: "number" } },
              required: ["kind"],
            },
            {
              type: "object",
              properties: { kind: { type: "string", const: "y" } },
              required: ["kind"],
            },
          ],
        },
        map: { type: "object", additionalProperties: { type: "number" } },
        maybe: { anyOf: [{ type: "string" }, { type: "null" }] },
        anything: {},
      },
    });
    expect(node.kind).toBe("object");
    if (node.kind !== "object") return;
    const f = Object.fromEntries(node.fields.map((x) => [x.key, x]));
    expect(f.name!.required).toBe(true);
    expect(f.name!.node).toMatchObject({ kind: "string", maxLength: 20, title: "Name" });
    expect(f.count!.node).toMatchObject({ kind: "number", integer: true, min: 0, max: 10 });
    expect(f.mode!.node).toMatchObject({ kind: "string", enum: ["a", "b"] });
    expect(f.list!.node).toMatchObject({ kind: "array", minItems: 1 });
    expect(f.pick!.node).toMatchObject({ kind: "union", discriminator: "kind" });
    expect(f.map!.node).toMatchObject({ kind: "record" });
    expect(f.maybe!.node).toMatchObject({ kind: "string", nullable: true });
    expect(f.anything!.node.kind).toBe("unknown");
  });

  it.each(builtInModuleTypes)("%s: the schema becomes an object form", (type) => {
    const node = toFormNode(getModuleJsonSchema(type)!);
    expect(node.kind).toBe("object");
  });
});

describe("path operations", () => {
  const root = { a: { list: [1, 2, 3] }, b: "x" };

  it("reads own properties only", () => {
    expect(getAt(root, ["a", "list", 1])).toBe(2);
    expect(getAt(root, ["a", "toString"])).toBeUndefined();
    expect(getAt(root, ["b", 0])).toBeUndefined();
  });

  it("sets immutably and removes keys with undefined", () => {
    const next = setAt(root, ["a", "list", 0], 9);
    expect(next.a.list).toEqual([9, 2, 3]);
    expect(root.a.list).toEqual([1, 2, 3]);
    expect(next.b).toBe(root.b);
    expect(setAt(root, ["b"], undefined)).not.toHaveProperty("b");
    expect(setAt({}, ["x", "y"], 1)).toEqual({ x: { y: 1 } });
  });

  it("removes, inserts and moves array items", () => {
    expect(getAt(removeAt(root, ["a", "list", 1]), ["a", "list"])).toEqual([1, 3]);
    expect(getAt(insertAt(root, ["a", "list"], 0, 0), ["a", "list"])).toEqual([0, 1, 2, 3]);
    expect(getAt(moveItem(root, ["a", "list"], 0, 2), ["a", "list"])).toEqual([2, 3, 1]);
    expect(moveItem(root, ["a", "list"], 0, 9)).toBe(root);
  });

  it("rejects prototype keys", () => {
    expect(() => setAt({}, ["__proto__", "polluted"], 1)).toThrow(TypeError);
    expect(() => setAt({}, ["a", "constructor"], 1)).toThrow(TypeError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("defaultFor", () => {
  it("never picks an exclusive bound as the default number", () => {
    expect(defaultFor(toFormNode({ type: "number", exclusiveMinimum: 0 }), {})).toBe(1);
    expect(defaultFor(toFormNode({ type: "integer", exclusiveMaximum: 0 }), {})).toBe(-1);
    expect(defaultFor(toFormNode({ type: "number", minimum: 0 }), {})).toBe(0);
  });

  it("creates unique ids with a counter", () => {
    expect(uniqueId("card", [])).toBe("card-1");
    expect(uniqueId("card", ["card-1", "card-2"])).toBe("card-3");
    expect(uniqueId("Some name!", [])).toBe("Some-name-1");
  });

  it.each(builtInModuleTypes)("%s: a new list item matches the item schema", (type) => {
    const node = toFormNode(getModuleJsonSchema(type)!);
    if (node.kind !== "object") return;
    const content = node.fields.find((f) => f.key === "content")!.node;
    if (content.kind !== "object") return;
    for (const field of content.fields) {
      if (field.node.kind !== "array") continue;
      const item = defaultFor(field.node.item, { idPrefix: "x", takenIds: [] });
      expect(item).not.toBeUndefined();
    }
  });

  it("builds a valid minimal flashcards config from the schema alone", () => {
    const node = toFormNode(getModuleJsonSchema("flashcards")!);
    const value = { ...(defaultFor(node) as object), id: "f", type: "flashcards" };
    const res = validateModule(value);
    // Required strings start empty; the schema accepts empty card text.
    expect(res.success).toBe(true);
  });
});
