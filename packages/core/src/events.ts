/** Result produced when a module completes. Scores are normalised to 0–1. */
export interface ModuleResult {
  moduleId: string;
  moduleType: string;
  status: "completed";
  /** 0–1. Undefined for modules without a notion of correctness (e.g. story cards). */
  score?: number;
  /** Number of correct answers (when applicable). */
  correct?: number;
  /** Number of scorable items (when applicable). */
  total?: number;
  /** Number of attempts made. */
  attempts: number;
  /** Milliseconds spent in the module. */
  durationMs: number;
  /** Module-specific details (serialisable). */
  details?: Record<string, unknown>;
  completedAt: string;
}

export type NibblearnEventType =
  | "lesson:start"
  | "lesson:resume"
  | "lesson:navigate"
  | "lesson:complete"
  | "lesson:reset"
  | "module:start"
  | "module:interact"
  | "module:answer"
  | "module:hint"
  | "module:complete"
  | "module:reset";

export interface NibblearnEvent {
  type: NibblearnEventType;
  /** ISO timestamp. */
  timestamp: string;
  lessonId?: string;
  moduleId?: string;
  moduleType?: string;
  /** Serialisable payload. */
  payload?: Record<string, unknown>;
}

export type EventHandler = (event: NibblearnEvent) => void;

/** Analytics adapters receive every event. They are never installed by default. */
export interface AnalyticsAdapter {
  track: EventHandler;
}

export function createEvent(
  type: NibblearnEventType,
  data: Omit<NibblearnEvent, "type" | "timestamp"> = {},
): NibblearnEvent {
  return { type, timestamp: new Date().toISOString(), ...data };
}
