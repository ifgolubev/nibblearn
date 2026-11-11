import { describe, expect, it } from "vitest";
import { builtInModuleTypes, validateLesson, validateModule, formatIssues } from "../src";
import * as examples from "../../../examples/src";

const entries = Object.entries(
  examples as Record<string, { id?: string; schemaVersion?: number; type?: string }>,
);

describe("example content", () => {
  it.each(entries.filter(([, v]) => v && v.schemaVersion === 1).map(([k, v]) => [k, v]))(
    "lesson %s is valid",
    (_name, lesson) => {
      const res = validateLesson(lesson);
      expect(res.success, res.success ? "" : formatIssues(res.issues)).toBe(true);
    },
  );
  it.each(entries.filter(([, v]) => v && typeof v.type === "string").map(([k, v]) => [k, v]))(
    "module %s is valid",
    (_name, mod) => {
      const res = validateModule(mod);
      expect(res.success, res.success ? "" : formatIssues(res.issues)).toBe(true);
    },
  );
  it("has a demo for every built-in module type", () => {
    const types = new Set(
      entries.filter(([, v]) => v && typeof v.type === "string").map(([, v]) => v.type),
    );
    expect([...types].sort()).toEqual([...builtInModuleTypes].sort());
  });
});
