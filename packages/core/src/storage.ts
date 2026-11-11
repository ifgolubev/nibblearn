import type { ModuleResult } from "./events";

/** Persisted lesson progress. Serialisable. */
export interface LessonProgress {
  version: 1;
  lessonId: string;
  /** Index of the current module (or -1 for the intro screen). */
  currentIndex: number;
  results: Record<string, ModuleResult>;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Storage adapter for lesson progress. Implement this to persist progress
 * anywhere (REST API, IndexedDB, …). All methods may be async.
 */
export interface ProgressStorage {
  load(lessonId: string): Promise<LessonProgress | null> | LessonProgress | null;
  save(progress: LessonProgress): Promise<void> | void;
  clear(lessonId: string): Promise<void> | void;
}

/** In-memory storage. Useful for tests and SSR. */
export function createMemoryStorage(): ProgressStorage & {
  dump(): Record<string, LessonProgress>;
} {
  const map = new Map<string, LessonProgress>();
  return {
    load: (id) => map.get(id) ?? null,
    save: (p) => {
      map.set(p.lessonId, p);
    },
    clear: (id) => {
      map.delete(id);
    },
    dump: () => Object.fromEntries(map),
  };
}

export interface LocalStorageOptions {
  /** Key prefix. Default "nibblearn:progress:". */
  prefix?: string;
  /** Custom Storage implementation (e.g. sessionStorage). Defaults to window.localStorage. */
  storage?: Storage;
}

function resolveStorage(custom?: Storage): Storage | null {
  if (custom) return custom;
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__nibblearn_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * localStorage-backed storage. SSR-safe: when `window` or localStorage is not available
 * (server, private mode, disabled storage) it silently falls back to in-memory storage.
 */
export function createLocalStorage(options: LocalStorageOptions = {}): ProgressStorage {
  const prefix = options.prefix ?? "nibblearn:progress:";
  const fallback = createMemoryStorage();
  return {
    load(lessonId) {
      const store = resolveStorage(options.storage);
      if (!store) return fallback.load(lessonId);
      try {
        const raw = store.getItem(prefix + lessonId);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LessonProgress;
        if (parsed && parsed.version === 1 && parsed.lessonId === lessonId) return parsed;
        return null;
      } catch {
        return null;
      }
    },
    save(progress) {
      const store = resolveStorage(options.storage);
      if (!store) return fallback.save(progress);
      try {
        store.setItem(prefix + progress.lessonId, JSON.stringify(progress));
      } catch {
        fallback.save(progress);
      }
    },
    clear(lessonId) {
      const store = resolveStorage(options.storage);
      fallback.clear(lessonId);
      if (!store) return;
      try {
        store.removeItem(prefix + lessonId);
      } catch {
        /* ignore */
      }
    },
  };
}

/** A storage that never persists anything. */
export const noopStorage: ProgressStorage = {
  load: () => null,
  save: () => {},
  clear: () => {},
};

export function createProgress(lessonId: string, now = new Date()): LessonProgress {
  const iso = now.toISOString();
  return { version: 1, lessonId, currentIndex: -1, results: {}, startedAt: iso, updatedAt: iso };
}
