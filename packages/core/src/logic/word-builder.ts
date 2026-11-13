import type { WordBuilderItem } from "../schema/modules/word-builder";
import { shuffle } from "../utils";

type ItemLike = Pick<WordBuilderItem, "tokens"> & { alternatives?: readonly (readonly string[])[] };

/** Tokens are compared by value: trimmed, inner whitespace collapsed, case-sensitive. */
export function normalizeWordToken(token: string): string {
  return token.trim().replace(/\s+/g, " ");
}

/** Every accepted order for an item: `tokens` first, then `alternatives`. */
export function acceptedWordOrders(item: ItemLike): string[][] {
  return [item.tokens, ...(item.alternatives ?? [])].map((order) => order.map(normalizeWordToken));
}

const OPERATOR_RE = /^(?:=|≠|≈|÷|×|\+|−|-|–|\*|\/|<|>|≤|≥|%|\(|\)|\^)$/;

/** True for single-glyph operators such as =, ÷, ×, +, − (styled as glyphs in formula mode). */
export function isOperatorToken(token: string): boolean {
  return OPERATOR_RE.test(normalizeWordToken(token));
}

export interface WordOrderEvaluation {
  /** The placement matches one accepted order exactly. */
  correct: boolean;
  /** One entry per placed tile: is it in the right position of the best-matching answer? */
  positions: boolean[];
  correctCount: number;
  /** Number of leading tiles in the right position (kept when the learner retries). */
  prefix: number;
  /** 1 when correct, otherwise positional matches ÷ max(answer length, placed length). */
  score: number;
  /** The accepted order the placement was compared with. */
  answer: string[];
}

/**
 * Compare placed tiles (by value, so duplicate tokens are interchangeable) with every
 * accepted order and report per-position correctness against the best match.
 */
export function evaluateWordOrder(
  item: ItemLike,
  placedTokens: readonly string[],
): WordOrderEvaluation {
  const placed = placedTokens.map(normalizeWordToken);
  const orders = acceptedWordOrders(item);
  let best: { answer: string[]; positions: boolean[]; matches: number; prefix: number } | null =
    null;
  for (const answer of orders) {
    const positions = placed.map((tok, i) => tok === answer[i]);
    const matches = positions.filter(Boolean).length;
    const firstWrong = positions.indexOf(false);
    const prefix = firstWrong === -1 ? positions.length : firstWrong;
    const exact = placed.length === answer.length && matches === answer.length;
    if (exact) {
      return { correct: true, positions, correctCount: matches, prefix, score: 1, answer };
    }
    if (!best || matches > best.matches || (matches === best.matches && prefix > best.prefix)) {
      best = { answer, positions, matches, prefix };
    }
  }
  // `orders` always has at least the `tokens` entry.
  const b = best!;
  const denom = Math.max(b.answer.length, placed.length, 1);
  return {
    correct: false,
    positions: b.positions,
    correctCount: b.matches,
    prefix: b.prefix,
    score: b.matches / denom,
    answer: b.answer,
  };
}

export interface WordTile {
  /** Stable per item: `t<index>` for answer tokens, `d<index>` for distractors. */
  id: string;
  text: string;
  distractor: boolean;
}

/**
 * Build the shuffled tile bank for an item. The answer tokens never appear in an accepted
 * order when read left to right (unless every arrangement is accepted).
 */
export function buildWordTiles(
  item: ItemLike & { distractors?: readonly string[] },
  seed?: number,
): WordTile[] {
  const tiles: WordTile[] = [
    ...item.tokens.map((text, i) => ({ id: `t${i}`, text, distractor: false })),
    ...(item.distractors ?? []).map((text, i) => ({ id: `d${i}`, text, distractor: true })),
  ];
  const accepted = new Set(acceptedWordOrders(item).map((o) => o.join("\u0000")));
  const readsAsAnswer = (order: WordTile[]) =>
    accepted.has(
      order
        .filter((t) => !t.distractor)
        .map((t) => normalizeWordToken(t.text))
        .join("\u0000"),
    );
  let out = shuffle(tiles, seed);
  for (let tries = 0; tries < 12 && readsAsAnswer(out); tries++) {
    out = shuffle(tiles, seed === undefined ? undefined : seed + 7919 * (tries + 1));
  }
  if (readsAsAnswer(out) && out.length > 1) {
    // Rotate as a last resort: moves the first answer token to the end.
    out = [...out.slice(1), out[0]!];
  }
  return out;
}

/**
 * Score for one item: full credit first time, −0.25 per extra attempt (floor 0.5);
 * half of the last partial score when the item was never solved.
 */
export function scoreWordItem({
  correct,
  attempts,
  lastScore,
}: {
  correct: boolean;
  attempts: number;
  lastScore: number;
}): number {
  if (correct) return attempts <= 1 ? 1 : Math.max(0.5, 1 - 0.25 * (attempts - 1));
  return Math.max(0, Math.min(1, lastScore)) * 0.5;
}
