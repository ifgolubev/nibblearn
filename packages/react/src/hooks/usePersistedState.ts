import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ModuleLifecycle } from "./useModuleLifecycle";

/** Validates a restored value; returns `undefined` for anything unexpected. */
export type StateGuard<T> = (raw: unknown) => T | undefined;

/**
 * `useState` whose value is saved in the module's state snapshot (`onStateChange`) and
 * restored from `initialState`. The value must be JSON-serialisable (store Sets as arrays).
 * `guard` is required: restored state is untrusted input.
 */
export function usePersistedState<T>(
  life: ModuleLifecycle,
  key: string,
  initial: T | (() => T),
  guard: StateGuard<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [state] = useState(() => {
    const raw = life.restore(key);
    const restored = raw === undefined ? undefined : guard(raw);
    // A saved value that fails its check invalidates the whole session (see `rejectRestore`).
    return { restored, rejected: raw !== undefined && restored === undefined };
  });
  const [value, setValue] = useState<T>(() =>
    state.restored !== undefined
      ? state.restored
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial,
  );
  const { rejectRestore } = life;
  useEffect(() => {
    if (state.rejected) rejectRestore();
  }, [state.rejected, rejectRestore]);
  useEffect(() => {
    life.persist(key, value);
  }, [life, key, value]);
  return [value, setValue];
}
