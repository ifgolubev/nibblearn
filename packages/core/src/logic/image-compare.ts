import type { CompareAnnotation } from "../schema/modules/image-compare";

/** Divider positions the learner must reach (≤ low and ≥ high) to count as explored. */
export const COMPARE_EXPLORE_LOW = 15;
export const COMPARE_EXPLORE_HIGH = 85;

/** Clamp a divider position to 0–100 and round to 0.1. */
export function clampComparePosition(position: number): number {
  if (!Number.isFinite(position)) return 50;
  return Math.round(Math.min(100, Math.max(0, position)) * 10) / 10;
}

/**
 * Keyboard steps for the divider slider. Returns the new position, or null when the key is
 * not handled. Arrow keys move 5, Page Up/Down 20, Home/End jump to the ends.
 */
export function compareKeyStep(position: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clampComparePosition(position - 5);
    case "ArrowRight":
    case "ArrowUp":
      return clampComparePosition(position + 5);
    case "PageDown":
      return clampComparePosition(position - 20);
    case "PageUp":
      return clampComparePosition(position + 20);
    case "Home":
      return 0;
    case "End":
      return 100;
    default:
      return null;
  }
}

/**
 * Whether an annotation is visible at the given divider position. The "before" image fills
 * 0…position and the "after" image position…100; `margin` keeps markers from straddling the divider.
 */
export function isAnnotationRevealed(
  annotation: Pick<CompareAnnotation, "x" | "side">,
  position: number,
  margin = 2,
): boolean {
  return annotation.side === "before"
    ? annotation.x <= position - margin
    : annotation.x >= position + margin;
}

/** A divider position that reveals the annotation, moving as little as possible. */
export function revealPositionFor(
  annotation: Pick<CompareAnnotation, "x" | "side">,
  position: number,
  gap = 12,
): number {
  if (isAnnotationRevealed(annotation, position)) return position;
  return annotation.side === "before"
    ? clampComparePosition(Math.max(position, annotation.x + gap))
    : clampComparePosition(Math.min(position, annotation.x - gap));
}

export interface CompareReach {
  /** Lowest divider position reached so far. */
  min: number;
  /** Highest divider position reached so far. */
  max: number;
}

export function trackCompareReach(reach: CompareReach, position: number): CompareReach {
  const min = Math.min(reach.min, position);
  const max = Math.max(reach.max, position);
  return min === reach.min && max === reach.max ? reach : { min, max };
}

export interface CompareExploreProgress {
  /** The "after" image has been seen (almost) in full: divider ≤ 15%. */
  afterSeen: boolean;
  /** The "before" image has been seen (almost) in full: divider ≥ 85%. */
  beforeSeen: boolean;
  openedCount: number;
  total: number;
  /** Both ends reached, or every annotation opened. */
  explored: boolean;
}

export function compareExploreProgress(
  reach: CompareReach,
  opened: readonly string[],
  annotationIds: readonly string[],
): CompareExploreProgress {
  const afterSeen = reach.min <= COMPARE_EXPLORE_LOW;
  const beforeSeen = reach.max >= COMPARE_EXPLORE_HIGH;
  const openedCount = annotationIds.filter((id) => opened.includes(id)).length;
  const total = annotationIds.length;
  const allOpened = total > 0 && openedCount >= total;
  return {
    afterSeen,
    beforeSeen,
    openedCount,
    total,
    explored: (afterSeen && beforeSeen) || allOpened,
  };
}
