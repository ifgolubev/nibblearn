import type { EstimateQuestion } from "../schema/modules/estimate";
import { formatValue } from "./simulator";

export type EstimateBand = "bullseye" | "close" | "off";

export interface EstimateAccuracy {
  band: EstimateBand;
  /** 1 within tolerance, falling linearly to 0 at 30% of the range away from the answer. */
  score: number;
  /** guess − answer (positive = too high). */
  delta: number;
  /** |guess − answer|. */
  error: number;
  /** Effective bullseye tolerance. */
  tolerance: number;
}

type QuestionLike = Pick<EstimateQuestion, "min" | "max" | "answer"> & {
  tolerance?: number;
};

const EPS = 1e-9;

/** Effective bullseye tolerance: the configured one, or 5% of the range. */
export function estimateTolerance(q: QuestionLike): number {
  return q.tolerance ?? (q.max - q.min) * 0.05;
}

/** Classify a guess and score it. */
export function estimateAccuracy(q: QuestionLike, guess: number): EstimateAccuracy {
  const tolerance = estimateTolerance(q);
  const range = q.max - q.min;
  const delta = guess - q.answer;
  const error = Math.abs(delta);
  const band: EstimateBand =
    error <= tolerance + EPS ? "bullseye" : error <= 3 * tolerance + EPS ? "close" : "off";
  const zeroAt = range * 0.3;
  let score: number;
  if (error <= tolerance + EPS) score = 1;
  else if (zeroAt <= tolerance) score = 0;
  else score = Math.min(1, Math.max(0, 1 - (error - tolerance) / (zeroAt - tolerance)));
  return { band, score, delta, error, tolerance };
}

function decimalsOf(step: number): number {
  const s = String(step);
  const e = s.indexOf("e-");
  if (e >= 0) return Number(s.slice(e + 2));
  const dot = s.indexOf(".");
  return dot >= 0 ? s.length - dot - 1 : 0;
}

/** Snap a raw value to the question's step grid and clamp it to [min, max]. */
export function snapEstimate(q: Pick<EstimateQuestion, "min" | "max" | "step">, raw: number) {
  if (!Number.isFinite(raw)) return q.min;
  const steps = Math.round((raw - q.min) / q.step);
  const v = Math.min(q.max, Math.max(q.min, q.min + steps * q.step));
  return Number(v.toFixed(Math.min(12, decimalsOf(q.step) + decimalsOf(q.min))));
}

/** A neutral starting guess: the middle of the scale, on the step grid. */
export function estimateStart(q: Pick<EstimateQuestion, "min" | "max" | "step">): number {
  return snapEstimate(q, (q.min + q.max) / 2);
}

function withUnit(text: string, unit?: string): string {
  if (!unit) return text;
  // Symbols such as "×" hug the number; words get a (non-breaking) space.
  return /^[\p{L}\p{N}]/u.test(unit) ? `${text}\u00a0${unit}` : `${text}${unit}`;
}

export interface EstimateFormatOptions {
  currency?: string;
  locale?: string;
}

/** Format a value on a question's scale, including its unit. */
export function formatEstimate(
  q: Pick<EstimateQuestion, "format" | "unit"> & { step?: number },
  value: number,
  opts: EstimateFormatOptions = {},
): string {
  const format = q.format ?? "number";
  if (
    format === "currency" &&
    q.step !== undefined &&
    decimalsOf(q.step) === 0 &&
    Number.isInteger(value)
  ) {
    // Whole-unit scales read better without cents: "$38", not "$38.00".
    try {
      return withUnit(
        new Intl.NumberFormat(opts.locale ?? "en", {
          style: "currency",
          currency: opts.currency ?? "USD",
          maximumFractionDigits: 0,
          minimumFractionDigits: 0,
        }).format(value),
        q.unit,
      );
    } catch {
      /* fall through */
    }
  }
  if (format === "percent" && q.step !== undefined && Number.isFinite(value)) {
    // Show as many decimals as the step needs (0.001 → one decimal).
    const digits = Math.min(4, Math.max(0, decimalsOf(q.step) - 2));
    try {
      return withUnit(
        new Intl.NumberFormat(opts.locale ?? "en", {
          style: "percent",
          minimumFractionDigits: 0,
          maximumFractionDigits: Math.max(1, digits),
        }).format(value),
        q.unit,
      );
    } catch {
      /* fall through */
    }
  }
  return withUnit(formatValue(value, format, opts), q.unit);
}

/**
 * Format the size of a miss: percentage points for "percent" questions ("0.4 pp"),
 * otherwise the value in the question's own format and unit.
 */
export function formatEstimateDelta(
  q: Pick<EstimateQuestion, "format" | "unit"> & { step?: number },
  delta: number,
  opts: EstimateFormatOptions & { pointsLabel?: string } = {},
): string {
  const abs = Math.abs(delta);
  if ((q.format ?? "number") === "percent") {
    const pp = abs * 100;
    let num: string;
    try {
      num = new Intl.NumberFormat(opts.locale ?? "en", { maximumFractionDigits: 2 }).format(
        Number(pp.toFixed(2)),
      );
    } catch {
      num = String(Number(pp.toFixed(2)));
    }
    return `${num}\u00a0${opts.pointsLabel ?? "pp"}`;
  }
  return formatEstimate(q, abs, opts);
}
