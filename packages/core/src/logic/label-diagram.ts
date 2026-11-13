import type { LabelTarget } from "../schema/modules/label-diagram";

/** A draggable label: either the correct label of a target or a distractor. */
export interface LabelChip {
  id: string;
  text: string;
  /** Set for correct labels: the target the chip belongs to. Undefined for distractors. */
  targetId?: string;
}

/** Chip id for a target's correct label. ":" never appears in config ids, so chip ids cannot clash. */
export function labelChipId(targetId: string): string {
  return `t:${targetId}`;
}

/** Chip id for the distractor at `index`. */
export function distractorChipId(index: number): string {
  return `d:${index}`;
}

/** All chips of a diagram, in config order (targets first, then distractors). */
export function labelDiagramChips(
  targets: readonly LabelTarget[],
  distractors: readonly string[] = [],
): LabelChip[] {
  return [
    ...targets.map((t) => ({ id: labelChipId(t.id), text: t.label, targetId: t.id })),
    ...distractors.map((text, i) => ({ id: distractorChipId(i), text })),
  ];
}

export interface LabelDiagramEvaluation {
  correct: boolean;
  /** targetId -> correct? (empty zones count as incorrect) */
  targets: Record<string, boolean>;
  correctCount: number;
  /** Fraction of targets labelled correctly (0–1). */
  score: number;
  /** Number of zones without a label. */
  empty: number;
}

/** @param placements targetId -> chipId (or undefined when the zone is empty) */
export function evaluateLabelDiagram(
  targets: readonly LabelTarget[],
  placements: Readonly<Record<string, string | undefined>>,
): LabelDiagramEvaluation {
  const result: Record<string, boolean> = {};
  let correctCount = 0;
  let empty = 0;
  for (const t of targets) {
    const placed = placements[t.id];
    if (!placed) empty++;
    const ok = placed === labelChipId(t.id);
    result[t.id] = ok;
    if (ok) correctCount++;
  }
  return {
    correct: targets.length > 0 && correctCount === targets.length,
    targets: result,
    correctCount,
    score: targets.length ? correctCount / targets.length : 0,
    empty,
  };
}

/**
 * Attempt-decay score (same rule as category sort): all correct on the first check = 1,
 * then −0.25 per extra attempt down to 0.5. If never fully correct, the first-check fraction.
 */
export function labelDiagramScore(
  attempts: number,
  allCorrect: boolean,
  firstFraction: number,
): number {
  if (allCorrect) return attempts <= 1 ? 1 : Math.max(0.5, 1 - 0.25 * (attempts - 1));
  return Math.max(0, Math.min(1, firstFraction));
}

/**
 * Which way a zone label extends from its anchor so it points toward the image centre
 * (and stays inside the frame): "right" for anchors in the left half, "left" otherwise.
 */
export function labelZoneSide(x: number): "left" | "right" {
  return x <= 50 ? "right" : "left";
}
