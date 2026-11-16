import type { StateGuard } from "./usePersistedState";

/**
 * Small validators for restored module state. Every guard returns `undefined` when the value
 * does not match, so the module falls back to its initial state.
 */
const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const unsafeKey = (key: string) =>
  key === "__proto__" || key === "constructor" || key === "prototype";

export const bool: StateGuard<boolean> = (raw) => (typeof raw === "boolean" ? raw : undefined);

export const str: StateGuard<string> = (raw) =>
  typeof raw === "string" && raw.length <= 10_000 ? raw : undefined;

export const num: StateGuard<number> = (raw) =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;

/** Integer within [min, max] (inclusive). */
export const int =
  (min: number, max: number): StateGuard<number> =>
  (raw) =>
    typeof raw === "number" && Number.isInteger(raw) && raw >= min && raw <= max ? raw : undefined;

/** Finite number within [min, max]. */
export const range =
  (min: number, max: number): StateGuard<number> =>
  (raw) =>
    typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max ? raw : undefined;

export const oneOf =
  <T extends string | number>(values: readonly T[]): StateGuard<T> =>
  (raw) =>
    (values as readonly unknown[]).includes(raw) ? (raw as T) : undefined;

/** Array whose every item passes `item`. */
export const arrayOf =
  <T>(item: StateGuard<T>, maxLength = 1000): StateGuard<T[]> =>
  (raw) => {
    if (!Array.isArray(raw) || raw.length > maxLength) return undefined;
    const out: T[] = [];
    for (const v of raw) {
      const ok = item(v);
      if (ok === undefined) return undefined;
      out.push(ok);
    }
    return out;
  };

/** Plain object whose keys pass `key` (default: any safe key) and values pass `value`. */
export const recordOf =
  <T>(
    value: StateGuard<T>,
    key: StateGuard<string> = str,
    maxKeys = 1000,
  ): StateGuard<Record<string, T>> =>
  (raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
    const keys = Object.keys(raw);
    if (keys.length > maxKeys) return undefined;
    const out: Record<string, T> = Object.create(null) as Record<string, T>;
    for (const k of keys) {
      if (unsafeKey(k) || key(k) === undefined || !own(raw, k)) return undefined;
      const v = value((raw as Record<string, unknown>)[k]);
      if (v === undefined) return undefined;
      out[k] = v;
    }
    return { ...out };
  };

/** Allows `null` in addition to what `guard` accepts. */
export const nullable =
  <T>(guard: StateGuard<T>): StateGuard<T | null> =>
  (raw) =>
    raw === null ? null : guard(raw);

/** Object with the given fields, each checked by its guard (extra fields are dropped). */
export const shape =
  <T extends object>(fields: {
    [K in keyof T]: StateGuard<T[K]>;
  }): StateGuard<T> =>
  (raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) {
      const v = (fields as Record<string, StateGuard<unknown>>)[k]!(
        own(raw, k) ? (raw as Record<string, unknown>)[k] : undefined,
      );
      if (v === undefined) return undefined;
      out[k] = v;
    }
    return out as T;
  };

/** An ordering of exactly the given ids (each once). */
export const permutationOf =
  (ids: readonly string[]): StateGuard<string[]> =>
  (raw) => {
    if (!Array.isArray(raw) || raw.length !== ids.length) return undefined;
    const want = new Set(ids);
    const seen = new Set<string>();
    for (const v of raw) {
      if (typeof v !== "string" || !want.has(v) || seen.has(v)) return undefined;
      seen.add(v);
    }
    return [...(raw as string[])];
  };

/** A record key that is an item index below `count` (JSON stores numeric keys as strings). */
export const indexKey =
  (count: number): StateGuard<string> =>
  (raw) =>
    typeof raw === "string" && /^\d+$/.test(raw) && Number(raw) < count ? raw : undefined;
