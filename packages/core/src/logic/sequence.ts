export interface SequenceEvaluation {
  correct: boolean;
  /** Per position: is the item in the right place? */
  positions: boolean[];
  correctCount: number;
  /** 0–1 fraction of items in the correct position. */
  score: number;
}

export function evaluateSequence(
  correctOrder: readonly string[],
  currentOrder: readonly string[],
): SequenceEvaluation {
  const positions = currentOrder.map((id, i) => id === correctOrder[i]);
  const correctCount = positions.filter(Boolean).length;
  return {
    correct: correctCount === correctOrder.length && currentOrder.length === correctOrder.length,
    positions,
    correctCount,
    score: correctOrder.length ? correctCount / correctOrder.length : 0,
  };
}

/** Move an item within an array (returns a new array). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = items.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item as T);
  return out;
}
