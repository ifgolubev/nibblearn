import { describe, expect, it } from "vitest";
import { stateFingerprint } from "../src";
import { moduleExamples } from "../src/examples";

describe("stateFingerprint", () => {
  const base = structuredClone(moduleExamples["true-false"]);
  const fp = (c: unknown) => stateFingerprint(c);

  it("ignores wording, settings outside content and new empty defaults", () => {
    const worded = structuredClone(base);
    worded.title = "Renamed";
    worded.content.statements[0]!.text = "Reworded statement";
    expect(fp(worded)).toBe(fp(base));

    const upgraded = structuredClone(base) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    upgraded.behavior = { ...upgraded.behavior, newFlag: false };
    upgraded.content.statements[0].newList = [];
    upgraded.content.newOption = null;
    expect(fp(upgraded)).toBe(fp(base));
  });

  it("changes with answers, items, ids and the module id", () => {
    const flipped = structuredClone(base);
    flipped.content.statements[0]!.isTrue = !flipped.content.statements[0]!.isTrue;
    expect(fp(flipped)).not.toBe(fp(base));

    const fewer = structuredClone(base);
    fewer.content.statements.pop();
    expect(fp(fewer)).not.toBe(fp(base));

    expect(fp({ ...base, id: "other" })).not.toBe(fp(base));
  });
});
