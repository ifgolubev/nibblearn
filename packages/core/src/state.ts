import type { ModuleResult } from "./events";
import { seedFromString } from "./utils";

/**
 * A JSON-serialisable snapshot of one module session, for restoring it later
 * (`initialState` / `onStateChange` on every module).
 */
export interface ModuleState {
  /** Snapshot format version. */
  v: 1;
  moduleId: string;
  moduleType: string;
  /**
   * Structural fingerprint of the config the state belongs to (`stateFingerprint`): changing
   * items, ids, links or answers discards the state; text edits and library updates that add
   * fields with empty defaults keep it.
   */
  configHash: string;
  /** Run number (increments on "Try again"); keeps shuffles stable after restore. */
  run: number;
  attempts: number;
  result: ModuleResult | null;
  /** Module-specific progress. */
  data: Record<string, unknown>;
  /** Time spent in the current run so far (ms), so `durationMs` continues after a restore. */
  elapsedMs?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1_000_000;

/**
 * Structural check for a stored `ModuleState`. Stored state is untrusted input: modules also
 * check every value they restore.
 */
export function isModuleState(value: unknown): value is ModuleState {
  if (!isRecord(value)) return false;
  const { v, moduleId, moduleType, configHash, run, attempts, result, data } = value;
  return (
    v === 1 &&
    typeof moduleId === "string" &&
    typeof moduleType === "string" &&
    typeof configHash === "string" &&
    isCount(run) &&
    isCount(attempts) &&
    (result === null ||
      (isRecord(result) &&
        result.status === "completed" &&
        result.moduleId === moduleId &&
        typeof result.attempts === "number")) &&
    isRecord(data) &&
    (value.elapsedMs === undefined ||
      (typeof value.elapsedMs === "number" &&
        Number.isFinite(value.elapsedMs) &&
        value.elapsedMs >= 0))
  );
}

/** Keys whose string values identify or link items (not display text). */
const STRUCTURAL_KEY =
  /(^id$|Id$|^next$|^start$|^to$|^correctAction$|^kind$|^type$|^mode$|^layout$|^position$)/;

/** Values a newly added optional field typically defaults to; they do not count. */
const isEmptyDefault = (v: unknown) =>
  v === false ||
  v === null ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);

/**
 * Fingerprint that ties a saved `ModuleState` to its content: the module id and type plus the
 * structure of `content` (ids, links, numbers, `true` flags, list lengths). Display text,
 * settings outside `content` and empty defaults are ignored, so editing wording or updating
 * the library keeps learners' sessions, while changing items or answers starts fresh.
 */
export function stateFingerprint(config: unknown): string {
  const c = (typeof config === "object" && config !== null ? config : {}) as Record<
    string,
    unknown
  >;
  const strip = (value: unknown, key: string): unknown => {
    if (Array.isArray(value)) return value.map((v) => strip(v, ""));
    if (typeof value === "object" && value !== null) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(value).sort()) {
        const v = strip((value as Record<string, unknown>)[k], k);
        if (v !== undefined && !isEmptyDefault(v)) out[k] = v;
      }
      return out;
    }
    if (typeof value === "string") return STRUCTURAL_KEY.test(key) ? value : undefined;
    return value;
  };
  return seedFromString(
    JSON.stringify([c.id ?? null, c.type ?? null, strip(c.content, "content") ?? null]),
  ).toString(36);
}

/** Short, stable fingerprint of a (parsed) module config: any change changes it. */
export function hashConfig(config: unknown): string {
  return seedFromString(JSON.stringify(config) ?? "").toString(36);
}
