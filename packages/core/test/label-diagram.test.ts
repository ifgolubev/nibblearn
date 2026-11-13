import { describe, expect, it } from "vitest";
import {
  distractorChipId,
  evaluateLabelDiagram,
  labelChipId,
  labelDiagramChips,
  labelDiagramSchema,
  labelDiagramScore,
  labelZoneSide,
  validateModule,
} from "../src";

const image = { src: "diagram.svg", alt: "A diagram", width: 1200, height: 700 };
const targets = [
  { id: "logo", x: 10, y: 10, label: "Logo" },
  { id: "cta", x: 80, y: 70, label: "Call to action" },
  { id: "legal", x: 50, y: 95, label: "Disclaimer" },
];

describe("label-diagram schema", () => {
  it("applies defaults", () => {
    const cfg = labelDiagramSchema.parse({
      id: "l",
      type: "label-diagram",
      content: { image, targets: targets.slice(0, 2) },
    });
    expect(cfg.content.distractors).toEqual([]);
    expect(cfg.behavior).toEqual({
      allowRetry: true,
      maxAttempts: 0,
      showExplanation: true,
      shuffle: true,
    });
  });

  it("rejects duplicate ids and duplicate labels across targets and distractors", () => {
    const res = validateModule({
      id: "l",
      type: "label-diagram",
      content: {
        image,
        targets: [
          { id: "a", x: 10, y: 10, label: "Logo" },
          { id: "a", x: 20, y: 20, label: "Headline" },
        ],
        distractors: ["logo ", "Pixel"],
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const messages = res.issues.map((i) => i.message).join("\n");
      expect(messages).toMatch(/duplicate target id "a"/);
      expect(messages).toMatch(/duplicate label/);
    }
  });

  it("requires 2–12 targets and percent coordinates", () => {
    expect(
      labelDiagramSchema.safeParse({
        id: "l",
        type: "label-diagram",
        content: { image, targets: targets.slice(0, 1) },
      }).success,
    ).toBe(false);
    expect(
      labelDiagramSchema.safeParse({
        id: "l",
        type: "label-diagram",
        content: {
          image,
          targets: [...targets.slice(0, 1), { id: "b", x: 120, y: 5, label: "B" }],
        },
      }).success,
    ).toBe(false);
  });
});

describe("label-diagram logic", () => {
  it("builds chips for targets and distractors with non-clashing ids", () => {
    const chips = labelDiagramChips(targets, ["Tracking pixel"]);
    expect(chips.map((c) => c.id)).toEqual(["t:logo", "t:cta", "t:legal", "d:0"]);
    expect(chips[0]).toEqual({ id: "t:logo", text: "Logo", targetId: "logo" });
    expect(chips[3]!.targetId).toBeUndefined();
    expect(distractorChipId(0)).toBe("d:0");
  });

  it("evaluates placements", () => {
    const all = evaluateLabelDiagram(targets, {
      logo: labelChipId("logo"),
      cta: labelChipId("cta"),
      legal: labelChipId("legal"),
    });
    expect(all).toMatchObject({ correct: true, correctCount: 3, score: 1, empty: 0 });

    const some = evaluateLabelDiagram(targets, {
      logo: labelChipId("cta"),
      cta: labelChipId("logo"),
      legal: labelChipId("legal"),
    });
    expect(some.correct).toBe(false);
    expect(some.targets).toEqual({ logo: false, cta: false, legal: true });
    expect(some.score).toBeCloseTo(1 / 3);

    const partial = evaluateLabelDiagram(targets, { logo: distractorChipId(0) });
    expect(partial).toMatchObject({ correct: false, correctCount: 0, empty: 2 });
    expect(evaluateLabelDiagram([], {}).correct).toBe(false);
  });

  it("decays the score per attempt like category sort", () => {
    expect(labelDiagramScore(1, true, 1)).toBe(1);
    expect(labelDiagramScore(2, true, 0.5)).toBe(0.75);
    expect(labelDiagramScore(3, true, 0.5)).toBe(0.5);
    expect(labelDiagramScore(6, true, 0.5)).toBe(0.5);
    expect(labelDiagramScore(2, false, 0.4)).toBe(0.4);
  });

  it("points zone labels toward the image centre", () => {
    expect(labelZoneSide(10)).toBe("right");
    expect(labelZoneSide(50)).toBe("right");
    expect(labelZoneSide(51)).toBe("left");
    expect(labelZoneSide(95)).toBe("left");
  });
});
