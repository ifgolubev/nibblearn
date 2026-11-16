import { useEffect } from "react";
import type { ModuleLifecycle } from "../hooks/useModuleLifecycle";

/**
 * Completion for content blocks (no score): on first view, or once every part was seen.
 * Calls `life.complete()` from an effect; it is a no-op once the module is complete.
 */
export function useBlockCompletion(
  life: ModuleLifecycle,
  completeOn: "view" | "all-items",
  seen: number,
  total: number,
) {
  const done = completeOn === "view" || seen >= total;
  useEffect(() => {
    if (done && !life.completed) life.complete({ details: { seen, total } });
  }, [done, life, seen, total]);
}
