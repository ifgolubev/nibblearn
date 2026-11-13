import type {
  MatrixItem,
  MatrixQuadrant,
  QuadrantPosition,
} from "../schema/modules/priority-matrix";
import { evaluateCategorySort, type CategorySortEvaluation } from "./category-sort";

/** Quadrant positions in reading order (row by row). */
export const QUADRANT_POSITIONS: readonly QuadrantPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export interface QuadrantCell {
  /** 1-based CSS grid row: 1 = top (high on the y axis). */
  row: 1 | 2;
  /** 1-based CSS grid column: 1 = left (low on the x axis). */
  column: 1 | 2;
  /** Level on each axis. */
  x: "low" | "high";
  y: "low" | "high";
}

/** Map a quadrant position to its grid cell and axis levels. */
export function quadrantCell(position: QuadrantPosition): QuadrantCell {
  const top = position.startsWith("top");
  const left = position.endsWith("left");
  return {
    row: top ? 1 : 2,
    column: left ? 1 : 2,
    x: left ? "low" : "high",
    y: top ? "high" : "low",
  };
}

/** Quadrants sorted into reading order: top-left, top-right, bottom-left, bottom-right. */
export function sortQuadrants<T extends Pick<MatrixQuadrant, "position">>(
  quadrants: readonly T[],
): T[] {
  return [...quadrants].sort(
    (a, b) => QUADRANT_POSITIONS.indexOf(a.position) - QUADRANT_POSITIONS.indexOf(b.position),
  );
}

export type PriorityMatrixEvaluation = CategorySortEvaluation;

/** @param assignments itemId -> quadrantId (or undefined when not placed) */
export function evaluatePriorityMatrix(
  items: readonly MatrixItem[],
  assignments: Readonly<Record<string, string | undefined>>,
): PriorityMatrixEvaluation {
  return evaluateCategorySort(
    items.map((i) => ({ id: i.id, text: i.text, categoryId: i.quadrantId })),
    assignments,
  );
}

/**
 * Module score: the first-check fraction, or — when everything was eventually placed
 * correctly without revealing — 1 on the first attempt, −0.25 per extra attempt (floor 0.5).
 * Never lower than the first-check fraction.
 */
export function priorityMatrixScore({
  attempts,
  allCorrect,
  revealed,
  firstFraction,
}: {
  attempts: number;
  allCorrect: boolean;
  revealed: boolean;
  firstFraction: number;
}): number {
  const first = Math.max(0, Math.min(1, firstFraction));
  if (!allCorrect || revealed) return first;
  const decayed = attempts <= 1 ? 1 : Math.max(0.5, 1 - 0.25 * (attempts - 1));
  return Math.max(first, decayed);
}
