import type { SortItem } from "../schema/modules/category-sort";

export interface CategorySortEvaluation {
  correct: boolean;
  /** itemId -> correct? (unassigned items count as incorrect) */
  items: Record<string, boolean>;
  correctCount: number;
  score: number;
  /** Number of items that were not placed into any category. */
  unassigned: number;
}

/** @param assignments itemId -> categoryId (or undefined when not placed) */
export function evaluateCategorySort(
  items: readonly SortItem[],
  assignments: Readonly<Record<string, string | undefined>>,
): CategorySortEvaluation {
  const result: Record<string, boolean> = {};
  let correctCount = 0;
  let unassigned = 0;
  for (const item of items) {
    const placed = assignments[item.id];
    if (!placed) unassigned++;
    const ok = placed === item.categoryId;
    result[item.id] = ok;
    if (ok) correctCount++;
  }
  return {
    correct: correctCount === items.length,
    items: result,
    correctCount,
    score: items.length ? correctCount / items.length : 0,
    unassigned,
  };
}
