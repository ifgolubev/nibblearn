import type { Blank } from "../schema/modules/fill-blanks";
import { normalizeAnswer, shuffle } from "../utils";

export type TemplateSegment = { kind: "text"; value: string } | { kind: "blank"; id: string };

const BLANK_RE = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

export function parseTemplate(template: string): TemplateSegment[] {
  const out: TemplateSegment[] = [];
  let last = 0;
  for (const m of template.matchAll(BLANK_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", value: template.slice(last, idx) });
    out.push({ kind: "blank", id: m[1]! });
    last = idx + m[0].length;
  }
  if (last < template.length) out.push({ kind: "text", value: template.slice(last) });
  return out;
}

export function isBlankCorrect(
  blank: Blank,
  answer: string | undefined,
  options: { caseSensitive?: boolean; lenient?: boolean } = {},
): boolean {
  if (!answer) return false;
  const given = normalizeAnswer(answer, options);
  return blank.answers.some((a) => normalizeAnswer(a, options) === given);
}

export interface FillBlanksEvaluation {
  correct: boolean;
  blanks: Record<string, boolean>;
  correctCount: number;
  score: number;
}

export function evaluateFillBlanks(
  blanks: readonly Blank[],
  answers: Readonly<Record<string, string | undefined>>,
  options: { caseSensitive?: boolean; lenient?: boolean } = {},
): FillBlanksEvaluation {
  const result: Record<string, boolean> = {};
  let correctCount = 0;
  for (const b of blanks) {
    const ok = isBlankCorrect(b, answers[b.id], options);
    result[b.id] = ok;
    if (ok) correctCount++;
  }
  return {
    correct: correctCount === blanks.length,
    blanks: result,
    correctCount,
    score: blanks.length ? correctCount / blanks.length : 0,
  };
}

export interface WordBankEntry {
  id: string;
  text: string;
}

/** Build the word bank: first accepted answer of each blank plus distractors. */
export function buildWordBank(
  blanks: readonly Blank[],
  distractors: readonly string[],
  { shuffle: doShuffle = true, seed }: { shuffle?: boolean; seed?: number } = {},
): WordBankEntry[] {
  const entries: WordBankEntry[] = [
    ...blanks.map((b, i) => ({ id: `w-${b.id}-${i}`, text: b.answers[0]! })),
    ...distractors.map((d, i) => ({ id: `d-${i}`, text: d })),
  ];
  return doShuffle ? shuffle(entries, seed) : entries;
}
