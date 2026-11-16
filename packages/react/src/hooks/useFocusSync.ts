import { useState } from "react";
import type { ConfigPath, ModuleLifecycle } from "./useModuleLifecycle";

/** Index of the focused item inside `config[...prefix]`, or undefined. */
export function focusIndex(
  path: ConfigPath | undefined,
  prefix: readonly string[],
): number | undefined {
  if (!path || path.length <= prefix.length) return undefined;
  for (let i = 0; i < prefix.length; i++) if (path[i] !== prefix[i]) return undefined;
  const n = path[prefix.length];
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : undefined;
}

/**
 * Preview mode: when `focus` points into `config[...prefix]`, call `apply(index)` once per
 * change (also on mount). `apply` must only set state of the calling component; it runs
 * during render, which React supports for a component's own state.
 */
export function useFocusSync(
  life: ModuleLifecycle,
  prefix: readonly string[],
  count: number,
  apply: (index: number) => void,
): void {
  const target = focusIndex(life.focusPath, prefix);
  const index = target === undefined || count === 0 ? undefined : Math.min(target, count - 1);
  const [applied, setApplied] = useState<number | undefined>(undefined);
  if (index !== undefined && index !== applied) {
    setApplied(index);
    apply(index);
  } else if (index === undefined && applied !== undefined) {
    setApplied(undefined);
  }
}
