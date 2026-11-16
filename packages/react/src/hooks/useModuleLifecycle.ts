import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  stateFingerprint,
  isModuleState,
  type ModuleResult,
  type ModuleState,
  type NibblearnEvent,
  type NibblearnEventType,
} from "@nibblearn/core";
import { useNibblearn } from "../context/NibblearnProvider";

/** Path into a module config, e.g. `["content", "cards", 4]`. */
export type ConfigPath = ReadonlyArray<string | number>;

export interface ModuleLifecycleOptions {
  moduleId: string;
  moduleType: string;
  onComplete?: (result: ModuleResult) => void;
  onEvent?: (event: NibblearnEvent) => void;
  /** Changing this value resets the module (used by LessonPlayer / demos). */
  resetKey?: unknown;
  /** The parsed config; its fingerprint ties a saved state to the content it was made for. */
  config?: unknown;
  /** A previous session to restore. Ignored when it belongs to another module or config. */
  initialState?: ModuleState | null;
  /** Receives a JSON-serialisable snapshot after every meaningful change. */
  onStateChange?: (state: ModuleState) => void;
  /** "preview" (editors): no events, no `onComplete`, no state snapshots. */
  mode?: "learn" | "preview";
  /** Preview only: the part of the config to bring into view. */
  focus?: { path: ConfigPath } | null;
}

export interface ModuleLifecycle {
  /** Emit an event scoped to this module. */
  emit: (type: NibblearnEventType, payload?: Record<string, unknown>) => void;
  /** Mark the module complete. Safe to call once per run; subsequent calls are ignored until reset. */
  complete: (
    partial?: Partial<Omit<ModuleResult, "moduleId" | "moduleType" | "status" | "completedAt">>,
  ) => ModuleResult | null;
  /** Register an attempt (e.g. a check). */
  attempt: () => number;
  attempts: number;
  completed: boolean;
  result: ModuleResult | null;
  /** Increment to force a reset from inside the module. */
  runId: number;
  reset: () => void;
  elapsedMs: () => number;
  /**
   * The value saved under `key` by a restored session, while the restored run is current.
   * Untrusted: check it before use (see `usePersistedState`).
   */
  restore: (key: string) => unknown;
  /** Save a JSON-serialisable progress value under `key` for `onStateChange`. */
  persist: (key: string, value: unknown) => void;
  /**
   * A restored value failed its check: the whole session is dropped and the module starts a
   * fresh run, so parts of a session are never combined with defaults.
   */
  rejectRestore: () => void;
  /** True in preview mode. */
  preview: boolean;
  /**
   * Whether the module may move focus by itself (autoFocus, focus after a step). False in
   * preview (the author is typing elsewhere) and in a restored session until the learner acts,
   * so restoring or editing never steals focus or scrolls the page.
   */
  autoFocus: boolean;
  /** Preview only: the focused config path. */
  focusPath: ConfigPath | undefined;
}

const hasOwn = (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key);

/** JSON round trip of saved data; anything that cannot be serialised is dropped. */
function jsonClone(data: Record<string, unknown>): Record<string, unknown> {
  try {
    const out: unknown = JSON.parse(JSON.stringify(data));
    return out && typeof out === "object" && !Array.isArray(out)
      ? (out as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Shared lifecycle for every module: start/complete/reset events, attempts, timing, state
 * snapshots for `initialState` / `onStateChange`, and preview mode.
 */
export function useModuleLifecycle({
  moduleId,
  moduleType,
  onComplete,
  onEvent,
  resetKey,
  config,
  initialState,
  onStateChange,
  mode = "learn",
  focus,
}: ModuleLifecycleOptions): ModuleLifecycle {
  const ctx = useNibblearn();
  const preview = mode === "preview";
  // Structural: text edits and library updates keep a saved session (see stateFingerprint).
  const configHash = useMemo(() => stateFingerprint(config), [config]);

  // The restored session is decided once; later changes to `initialState` are ignored.
  const [restored] = useState<ModuleState | null>(() =>
    !preview &&
    isModuleState(initialState) &&
    initialState.moduleId === moduleId &&
    initialState.moduleType === moduleType &&
    initialState.configHash === configHash
      ? initialState
      : null,
  );

  // A restored run continues its clock (capped at a day, in case the saved value is odd).
  const startedAt = useRef<number>(
    Date.now() - Math.min(restored?.elapsedMs ?? 0, 24 * 60 * 60 * 1000),
  );
  const [attempts, setAttempts] = useState(restored?.attempts ?? 0);
  const attemptsRef = useRef(restored?.attempts ?? 0);
  const [result, setResult] = useState<ModuleResult | null>(restored?.result ?? null);
  const resultRef = useRef<ModuleResult | null>(restored?.result ?? null);
  const [runId, setRunId] = useState(restored?.run ?? 0);
  const runIdRef = useRef(restored?.run ?? 0);
  const dataRef = useRef<Record<string, unknown>>(restored ? { ...restored.data } : {});
  const [acted, setActed] = useState(restored === null);
  // Effects compare with the last handled value instead of a "first run" flag, so running an
  // effect twice (StrictMode, <Activity> hide/show) neither resets nor re-starts a module.
  const lastResetKey = useRef(resetKey);
  const startedRun = useRef<number | null>(restored ? restored.run : null);
  const onEventRef = useRef(onEvent);
  const onCompleteRef = useRef(onComplete);
  const onStateChangeRef = useRef(onStateChange);
  const previewRef = useRef(preview);
  onEventRef.current = onEvent;
  onCompleteRef.current = onComplete;
  onStateChangeRef.current = onStateChange;
  previewRef.current = preview;

  // ---- state snapshots ------------------------------------------------------------------------
  const snapshot = useCallback(
    (): ModuleState => ({
      v: 1,
      moduleId,
      moduleType,
      configHash,
      run: runIdRef.current,
      attempts: attemptsRef.current,
      result: resultRef.current,
      data: jsonClone(dataRef.current),
      elapsedMs: resultRef.current ? resultRef.current.durationMs : Date.now() - startedAt.current,
    }),
    [moduleId, moduleType, configHash],
  );
  // Snapshots are compared without the clock, so an unchanged session is not sent again.
  const comparable = (state: ModuleState) => JSON.stringify({ ...state, elapsedMs: undefined });
  const lastSent = useRef<string | null>(restored ? comparable(restored) : null);
  const scheduled = useRef(false);
  const scheduleNotify = useCallback(() => {
    if (scheduled.current || previewRef.current || !onStateChangeRef.current) return;
    scheduled.current = true;
    queueMicrotask(() => {
      scheduled.current = false;
      const handler = onStateChangeRef.current;
      if (!handler || previewRef.current) return;
      const state = snapshot();
      const json = comparable(state);
      if (json === lastSent.current) return;
      lastSent.current = json;
      handler(state);
    });
  }, [snapshot]);

  // Saved data in its JSON form (explicit `undefined` values dropped), as it would come back
  // from storage, so a session passed back in memory restores exactly like a stored one.
  const restoredData = useMemo(() => (restored ? jsonClone(restored.data) : null), [restored]);
  // Only for the module and content the session was saved for: a lifecycle that later gets
  // another module or a structurally edited config starts clean.
  const restore = useCallback(
    (key: string): unknown =>
      restoredData &&
      runIdRef.current === restored!.run &&
      restored!.moduleId === moduleId &&
      restored!.configHash === configHash &&
      hasOwn(restoredData, key)
        ? restoredData[key]
        : undefined,
    [restored, restoredData, moduleId, configHash],
  );

  const persist = useCallback(
    (key: string, value: unknown) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") return;
      dataRef.current[key] = value;
      scheduleNotify();
    },
    [scheduleNotify],
  );

  // ---- events ---------------------------------------------------------------------------------
  const emit = useCallback(
    (type: NibblearnEventType, payload?: Record<string, unknown>) => {
      if (previewRef.current) return;
      if (type !== "module:start" && type !== "module:reset") setActed(true);
      const data = { moduleId, moduleType, payload };
      ctx.emit(type, data);
      onEventRef.current?.({ type, timestamp: new Date().toISOString(), ...data });
    },
    [ctx, moduleId, moduleType],
  );

  const reset = useCallback(() => {
    setActed(true);
    startedAt.current = Date.now();
    attemptsRef.current = 0;
    resultRef.current = null;
    runIdRef.current += 1;
    dataRef.current = {};
    setAttempts(0);
    setResult(null);
    setRunId(runIdRef.current);
    scheduleNotify();
  }, [scheduleNotify]);

  // Emit start on mount and on every reset (not when resuming a restored session).
  useEffect(() => {
    if (startedRun.current === runId) return;
    startedRun.current = runId;
    emit("module:start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // External reset key.
  useEffect(() => {
    if (Object.is(lastResetKey.current, resetKey)) return;
    lastResetKey.current = resetKey;
    reset();
    emit("module:reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const elapsedMs = useCallback(() => Date.now() - startedAt.current, []);

  const rejectRestore = useCallback(() => {
    if (restored && runIdRef.current === restored.run) reset();
  }, [restored, reset]);

  const attempt = useCallback(() => {
    setActed(true);
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    scheduleNotify();
    return attemptsRef.current;
  }, [scheduleNotify]);

  const complete = useCallback<ModuleLifecycle["complete"]>(
    (partial = {}) => {
      if (resultRef.current) return null;
      const res: ModuleResult = {
        moduleId,
        moduleType,
        status: "completed",
        attempts: Math.max(attemptsRef.current, partial.attempts ?? 0),
        durationMs: Date.now() - startedAt.current,
        completedAt: new Date().toISOString(),
        ...partial,
      };
      resultRef.current = res;
      setResult(res);
      if (previewRef.current) return res;
      emit("module:complete", {
        score: res.score,
        correct: res.correct,
        total: res.total,
        attempts: res.attempts,
        durationMs: res.durationMs,
      });
      onCompleteRef.current?.(res);
      scheduleNotify();
      return res;
    },
    [emit, moduleId, moduleType, scheduleNotify],
  );

  const focusPath = preview ? focus?.path : undefined;
  const autoFocus = !preview && acted;

  return useMemo(
    () => ({
      emit,
      complete,
      attempt,
      attempts,
      completed: result !== null,
      result,
      runId,
      reset,
      elapsedMs,
      restore,
      persist,
      rejectRestore,
      preview,
      autoFocus,
      focusPath,
    }),
    [
      rejectRestore,
      autoFocus,
      emit,
      complete,
      attempt,
      attempts,
      result,
      runId,
      reset,
      elapsedMs,
      restore,
      persist,
      preview,
      focusPath,
    ],
  );
}
