import { describe, expect, it } from "vitest";
import {
  clampComparePosition,
  compareExploreProgress,
  compareKeyStep,
  imageCompareSchema,
  isAnnotationRevealed,
  revealPositionFor,
  trackCompareReach,
  validateModule,
} from "../src";

const before = { image: { src: "before.svg", alt: "Before", width: 1200, height: 800 } };
const after = { image: { src: "after.svg", alt: "After", width: 1200, height: 800 } };

describe("image-compare schema", () => {
  it("applies defaults", () => {
    const cfg = imageCompareSchema.parse({
      id: "c",
      type: "image-compare",
      content: { before, after },
    });
    expect(cfg.content.before.label).toBe("Before");
    expect(cfg.content.after.label).toBe("After");
    expect(cfg.content.annotations).toEqual([]);
    expect(cfg.behavior).toEqual({ initialPosition: 50, requireExplore: true });
  });

  it("rejects duplicate annotation ids and questions without a correct option", () => {
    const res = validateModule({
      id: "c",
      type: "image-compare",
      content: {
        before,
        after,
        annotations: [
          { id: "a", x: 10, y: 10, side: "before", title: "A", text: "a" },
          { id: "a", x: 60, y: 10, side: "after", title: "B", text: "b" },
        ],
        question: { prompt: "?", options: [{ text: "x" }, { text: "y" }] },
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const messages = res.issues.map((i) => i.message).join("\n");
      expect(messages).toMatch(/duplicate annotation id "a"/);
      expect(messages).toMatch(/at least one option must be correct/);
    }
  });

  it("limits annotations, options and the initial position", () => {
    const annotation = (i: number) => ({
      id: `n${i}`,
      x: 10,
      y: 10,
      side: "before" as const,
      title: "T",
      text: "t",
    });
    expect(
      imageCompareSchema.safeParse({
        id: "c",
        type: "image-compare",
        content: { before, after, annotations: Array.from({ length: 9 }, (_, i) => annotation(i)) },
      }).success,
    ).toBe(false);
    expect(
      imageCompareSchema.safeParse({
        id: "c",
        type: "image-compare",
        content: {
          before,
          after,
          question: { prompt: "?", options: [{ text: "a", correct: true }] },
        },
      }).success,
    ).toBe(false);
    expect(
      imageCompareSchema.safeParse({
        id: "c",
        type: "image-compare",
        content: { before, after },
        behavior: { initialPosition: 120 },
      }).success,
    ).toBe(false);
  });
});

describe("image-compare logic", () => {
  it("clamps and rounds positions", () => {
    expect(clampComparePosition(-4)).toBe(0);
    expect(clampComparePosition(104)).toBe(100);
    expect(clampComparePosition(33.333)).toBe(33.3);
    expect(clampComparePosition(Number.NaN)).toBe(50);
  });

  it("maps keys to slider steps", () => {
    expect(compareKeyStep(50, "ArrowRight")).toBe(55);
    expect(compareKeyStep(50, "ArrowUp")).toBe(55);
    expect(compareKeyStep(50, "ArrowLeft")).toBe(45);
    expect(compareKeyStep(2, "ArrowDown")).toBe(0);
    expect(compareKeyStep(50, "PageUp")).toBe(70);
    expect(compareKeyStep(90, "PageUp")).toBe(100);
    expect(compareKeyStep(50, "PageDown")).toBe(30);
    expect(compareKeyStep(50, "Home")).toBe(0);
    expect(compareKeyStep(50, "End")).toBe(100);
    expect(compareKeyStep(50, "Enter")).toBeNull();
  });

  it("shows annotations only on their revealed side", () => {
    const b = { x: 30, side: "before" as const };
    const a = { x: 70, side: "after" as const };
    expect(isAnnotationRevealed(b, 50)).toBe(true);
    expect(isAnnotationRevealed(b, 31)).toBe(false);
    expect(isAnnotationRevealed(b, 32)).toBe(true);
    expect(isAnnotationRevealed(a, 50)).toBe(true);
    expect(isAnnotationRevealed(a, 69)).toBe(false);
    expect(isAnnotationRevealed(a, 50, 0)).toBe(true);
  });

  it("finds the nearest position that reveals an annotation", () => {
    expect(revealPositionFor({ x: 30, side: "before" }, 50)).toBe(50);
    expect(revealPositionFor({ x: 60, side: "before" }, 50)).toBe(72);
    expect(revealPositionFor({ x: 95, side: "before" }, 50)).toBe(100);
    expect(revealPositionFor({ x: 40, side: "after" }, 50)).toBe(28);
    expect(revealPositionFor({ x: 5, side: "after" }, 50)).toBe(0);
  });

  it("tracks reach and explore progress", () => {
    let reach = { min: 50, max: 50 };
    expect(trackCompareReach(reach, 50)).toBe(reach);
    reach = trackCompareReach(reach, 12);
    reach = trackCompareReach(reach, 60);
    expect(reach).toEqual({ min: 12, max: 60 });
    let p = compareExploreProgress(reach, [], ["a", "b"]);
    expect(p).toMatchObject({ afterSeen: true, beforeSeen: false, explored: false, total: 2 });
    reach = trackCompareReach(reach, 85);
    p = compareExploreProgress(reach, [], ["a", "b"]);
    expect(p.explored).toBe(true);

    const notes = compareExploreProgress({ min: 50, max: 50 }, ["a", "b", "x"], ["a", "b"]);
    expect(notes).toMatchObject({ openedCount: 2, explored: true });
    expect(compareExploreProgress({ min: 40, max: 60 }, [], []).explored).toBe(false);
  });
});
