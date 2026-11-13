import type { ModuleResult } from "./events";
import type { Lesson } from "./schema/lesson";
import type { LessonProgress } from "./storage";

export interface LessonScore {
  /** Weighted average score across scorable modules (0–1). */
  score: number;
  /** Modules with a numeric score. */
  scoredModules: number;
  completedModules: number;
  totalModules: number;
  /** Gamification points (0 when disabled). */
  points: number;
  maxPoints: number;
  passed: boolean;
}

function weightOf(m: Lesson["modules"][number]): number {
  const s = (m as { scoring?: { weight?: number } }).scoring;
  return typeof s?.weight === "number" ? s.weight : 1;
}

/** Default pass threshold used when a module does not set `scoring.passThreshold`. */
export const DEFAULT_PASS_THRESHOLD = 0.7;

/** Threshold (0–1) a module's score must reach to count as passed. */
export function modulePassThreshold(m: Lesson["modules"][number]): number {
  const s = (m as { scoring?: { passThreshold?: number } }).scoring;
  return typeof s?.passThreshold === "number" && s.passThreshold > 0
    ? s.passThreshold
    : DEFAULT_PASS_THRESHOLD;
}

/** Whether a module result passes its module's threshold (unscored modules always pass). */
export function moduleResultPassed(
  m: Lesson["modules"][number],
  r: ModuleResult | undefined,
): boolean {
  if (!r) return false;
  return typeof r.score !== "number" || r.score >= modulePassThreshold(m);
}

export function computeLessonScore(
  lesson: Lesson,
  results: Record<string, ModuleResult>,
): LessonScore {
  let weighted = 0;
  let weightSum = 0;
  let scored = 0;
  let completed = 0;
  let points = 0;
  const perModule = lesson.gamification.points ? lesson.gamification.pointsPerModule : 0;
  for (const m of lesson.modules) {
    const r = results[m.id];
    if (!r) continue;
    completed++;
    if (typeof r.score === "number") {
      weighted += r.score * weightOf(m);
      weightSum += weightOf(m);
      scored++;
      points += Math.round(r.score * perModule);
    } else {
      points += perModule;
    }
  }
  const score = weightSum > 0 ? weighted / weightSum : completed > 0 ? 1 : 0;
  const total = lesson.modules.length;
  const rule = lesson.completion;
  const passed =
    rule.rule === "score"
      ? score >= rule.threshold && completed === total
      : rule.rule === "all-modules"
        ? completed === total
        : completed > 0;
  return {
    score,
    scoredModules: scored,
    completedModules: completed,
    totalModules: total,
    points,
    maxPoints: perModule * total,
    passed,
  };
}

export function isLessonComplete(lesson: Lesson, progress: LessonProgress): boolean {
  const last = lesson.modules[lesson.modules.length - 1];
  if (!last) return false;
  if (lesson.completion.rule === "any") return Boolean(progress.results[last.id]);
  return computeLessonScore(lesson, progress.results).passed;
}

/** Fraction of modules completed, 0–1. */
export function lessonProgressFraction(lesson: Lesson, progress: LessonProgress): number {
  if (lesson.modules.length === 0) return 0;
  const done = lesson.modules.filter((m) => progress.results[m.id]).length;
  return done / lesson.modules.length;
}
