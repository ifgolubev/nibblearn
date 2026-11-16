import { describe, expect, it } from "vitest";
import { builtInModuleDefinitions, builtInModuleTypes, formatIssues, validateModule } from "../src";
import { createEmpty, createExample, emptyModules, moduleExamples } from "../src/examples";

describe("createExample / createEmpty", () => {
  it.each(builtInModuleTypes)("%s: both creators return valid configs", (type) => {
    for (const config of [createExample(type), createEmpty(type)]) {
      const res = validateModule(config);
      expect(res.success, res.success ? "" : formatIssues(res.issues)).toBe(true);
      expect(config.type).toBe(type);
    }
    expect(createExample(type).id).toBe(`${type}-example`);
    expect(createEmpty(type).id).toBe(`${type}-new`);
  });

  it("applies the id option", () => {
    expect(createExample("flashcards", { id: "deck" }).id).toBe("deck");
    expect(createEmpty("estimate", { id: "guess" }).id).toBe("guess");
  });

  it("returns independent deep copies", () => {
    const a = createEmpty("flashcards");
    a.content.cards[0]!.front = "changed";
    a.content.cards.push({ front: "x", back: "y" });
    const b = createEmpty("flashcards");
    expect(b.content.cards).toHaveLength(1);
    expect(b.content.cards[0]!.front).toBe("Term");
    expect(emptyModules.flashcards.content.cards[0]!.front).toBe("Term");

    const c = createExample("true-false");
    c.content.statements.length = 0;
    expect(moduleExamples["true-false"].content.statements.length).toBeGreaterThan(0);
  });

  it("covers every built-in type and nothing else", () => {
    expect(Object.keys(moduleExamples).sort()).toEqual([...builtInModuleTypes].sort());
    expect(Object.keys(emptyModules).sort()).toEqual([...builtInModuleTypes].sort());
  });

  it("rejects unknown and inherited types", () => {
    expect(() => createEmpty("nope" as never)).toThrow(TypeError);
    expect(() => createExample("toString" as never)).toThrow(TypeError);
  });
});

describe("module definitions", () => {
  it.each(builtInModuleDefinitions.map((d) => [d.type, d] as const))(
    "%s has a kebab-case icon",
    (_type, def) => {
      expect(def.icon).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    },
  );
});
