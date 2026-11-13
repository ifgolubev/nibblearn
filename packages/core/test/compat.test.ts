import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { builtInModuleTypes, formatIssues, validateLesson } from "../src";

/**
 * Lesson JSON compatibility contract. Fixtures are frozen copies of lessons written
 * against schemaVersion 1. New module types are additive: every fixture must keep
 * validating, unchanged, as the library grows.
 */
const dir = join(__dirname, "fixtures");
const fixtures = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("lesson JSON compatibility (schemaVersion 1)", () => {
  it.each(fixtures)("%s still validates", (file) => {
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const res = validateLesson(json);
    expect(res.success, res.success ? "" : formatIssues(res.issues)).toBe(true);
    if (res.success) {
      expect(res.data.schemaVersion).toBe(1);
      expect(res.data.modules.map((m) => m.id)).toEqual(
        json.modules.map((m: { id: string }) => m.id),
      );
    }
  });

  it("keeps the original 15 module types", () => {
    for (const t of [
      "story-cards",
      "flashcards",
      "choice-challenge",
      "true-false",
      "match-pairs",
      "sequence-builder",
      "category-sort",
      "fill-blanks",
      "hotspot-explorer",
      "screenshot-walkthrough",
      "branching-scenario",
      "conversation",
      "process-explorer",
      "spot-the-mistake",
      "what-if-simulator",
    ]) {
      expect(builtInModuleTypes).toContain(t);
    }
  });

  it("rejects unknown module types with a readable error and unknown schema versions", () => {
    const unknown = validateLesson({
      schemaVersion: 1,
      id: "x",
      title: "X",
      modules: [{ id: "m", type: "not-a-module", content: {} }],
    });
    expect(unknown.success).toBe(false);
    if (!unknown.success) expect(unknown.issues[0]?.path).toContain("modules[0]");
    const future = validateLesson({ schemaVersion: 2, id: "x", title: "X", modules: [] });
    expect(future.success).toBe(false);
  });
});
