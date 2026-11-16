import { describe, expect, it } from "vitest";
import {
  defaultSchemaRegistry,
  migrateLesson,
  migrateModule,
  validateLesson,
  validateModule,
} from "../src";
import { createEmpty } from "../src/examples";

const two = [createEmpty("callout", { id: "same" }), createEmpty("callout", { id: "same" })];
const results = [
  validateLesson({ schemaVersion: 1, id: "l", title: "L", modules: two }),
  validateLesson(
    { schemaVersion: 1, id: "l", title: "L", modules: two },
    { registry: defaultSchemaRegistry },
  ),
  validateLesson({ schemaVersion: 1, id: "l", title: "L", modules: [{ id: "x", type: "nope" }] }),
  validateModule({ id: "x" }),
  validateModule({ id: "x", type: "nope" }),
  migrateModule({ id: "x", type: "callout", schemaVersion: 99 }),
  migrateLesson({ modules: [{ id: "x", type: "callout", schemaVersion: 99 }] }),
  migrateLesson("nope"),
];

describe("every issue says where it is", () => {
  it.each(results.map((r, i) => [i, r] as const))("result %i", (_, r) => {
    expect(r.success).toBe(false);
    for (const issue of r.success ? [] : r.issues) expect(Array.isArray(issue.segments)).toBe(true);
  });
});
