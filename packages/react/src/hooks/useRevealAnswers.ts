import { DEFAULT_PASS_THRESHOLD, type Scoring } from "@nibblearn/core";
import type { ModuleLifecycle } from "./useModuleLifecycle";

/**
 * Whether the correct answers may be shown right now (`scoring.revealAnswers`). With
 * "after-pass" that is only after the module completed with a score that reaches the pass
 * threshold; with "never" it is never. Which of the learner's own answers are wrong is not an
 * answer and stays visible.
 */
export function useRevealAnswers(life: ModuleLifecycle, scoring: Scoring | undefined): boolean {
  const policy = scoring?.revealAnswers ?? "always";
  if (policy === "always") return true;
  if (policy === "never") return false;
  const result = life.result;
  if (!result) return false;
  // As in `modulePassThreshold()`: no threshold set means the default one.
  const threshold =
    scoring && scoring.passThreshold > 0 ? scoring.passThreshold : DEFAULT_PASS_THRESHOLD;
  return result.score === undefined || result.score >= threshold;
}
