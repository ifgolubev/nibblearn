import type { ChoiceOption, ChoiceQuestion } from "../schema/modules/choice-challenge";

export interface ChoiceOptionWithId extends ChoiceOption {
  id: string;
}

/** Ensure every option has a stable id. */
export function withOptionIds(question: ChoiceQuestion, questionIndex = 0): ChoiceOptionWithId[] {
  return question.options.map((o, i) => ({ ...o, id: o.id ?? `q${questionIndex}-opt${i}` }));
}

export function questionMode(question: ChoiceQuestion): "single" | "multiple" {
  if (question.mode) return question.mode;
  return question.options.filter((o) => o.correct).length > 1 ? "multiple" : "single";
}

export interface ChoiceEvaluation {
  correct: boolean;
  /** 0–1 */
  score: number;
  correctIds: string[];
  /** Selected but wrong. */
  wrongIds: string[];
  /** Correct but not selected. */
  missedIds: string[];
}

export function evaluateChoice(
  options: ChoiceOptionWithId[],
  selectedIds: readonly string[],
  { partialCredit = true }: { partialCredit?: boolean } = {},
): ChoiceEvaluation {
  const correctIds = options.filter((o) => o.correct).map((o) => o.id);
  const selected = new Set(selectedIds);
  const wrongIds = [...selected].filter((id) => !correctIds.includes(id));
  const missedIds = correctIds.filter((id) => !selected.has(id));
  const correct = wrongIds.length === 0 && missedIds.length === 0;
  let score = correct ? 1 : 0;
  if (!correct && partialCredit && correctIds.length > 0) {
    const hits = correctIds.length - missedIds.length;
    // Penalise wrong selections; never below zero.
    score = Math.max(0, (hits - wrongIds.length) / correctIds.length);
  }
  return { correct, score, correctIds, wrongIds, missedIds };
}
