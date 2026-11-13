/** Score for "find all" style activities: found/total minus a penalty per wrong pick. */
export function findAllScore(found: number, total: number, wrong: number, penalty = 0.15): number {
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, found / total - wrong * penalty));
}

/** Score for matching: fewer mistakes = higher score. */
export function matchingScore(pairs: number, mistakes: number): number {
  if (pairs <= 0) return 1;
  return Math.max(0, 1 - mistakes / (pairs * 2));
}

/** Score for attempts-based tasks: full credit first try, decays per retry. */
export function attemptScore(attempts: number, decay = 0.25): number {
  return Math.max(0, 1 - Math.max(0, attempts - 1) * decay);
}
