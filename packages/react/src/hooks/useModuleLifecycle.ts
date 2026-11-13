import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NibblearnEvent, NibblearnEventType, ModuleResult } from "@nibblearn/core";
import { useNibblearn } from "../context/NibblearnProvider";

export interface ModuleLifecycleOptions {
  moduleId: string;
  moduleType: string;
  onComplete?: (result: ModuleResult) => void;
  onEvent?: (event: NibblearnEvent) => void;
  /** Changing this value resets the module (used by LessonPlayer / demos). */
  resetKey?: unknown;
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
}

/**
 * Shared lifecycle for every module: start/complete/reset events, attempts, timing.
 */
export function useModuleLifecycle({
  moduleId,
  moduleType,
  onComplete,
  onEvent,
  resetKey,
}: ModuleLifecycleOptions): ModuleLifecycle {
  const ctx = useNibblearn();
  const startedAt = useRef<number>(Date.now());
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(0);
  const [result, setResult] = useState<ModuleResult | null>(null);
  const resultRef = useRef<ModuleResult | null>(null);
  const [runId, setRunId] = useState(0);
  const firstRender = useRef(true);
  const onEventRef = useRef(onEvent);
  const onCompleteRef = useRef(onComplete);
  onEventRef.current = onEvent;
  onCompleteRef.current = onComplete;

  const emit = useCallback(
    (type: NibblearnEventType, payload?: Record<string, unknown>) => {
      const data = { moduleId, moduleType, payload };
      ctx.emit(type, data);
      onEventRef.current?.({ type, timestamp: new Date().toISOString(), ...data });
    },
    [ctx, moduleId, moduleType],
  );

  const reset = useCallback(() => {
    startedAt.current = Date.now();
    attemptsRef.current = 0;
    resultRef.current = null;
    setAttempts(0);
    setResult(null);
    setRunId((r) => r + 1);
  }, []);

  // Emit start on mount and on every reset.
  useEffect(() => {
    emit("module:start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // External reset key.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    reset();
    emit("module:reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const elapsedMs = useCallback(() => Date.now() - startedAt.current, []);

  const attempt = useCallback(() => {
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    return attemptsRef.current;
  }, []);

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
      emit("module:complete", {
        score: res.score,
        correct: res.correct,
        total: res.total,
        attempts: res.attempts,
      });
      onCompleteRef.current?.(res);
      return res;
    },
    [emit, moduleId, moduleType],
  );

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
    }),
    [emit, complete, attempt, attempts, result, runId, reset, elapsedMs],
  );
}
