import { describe, expect, it } from "vitest";
import {
  computeLessonScore,
  createLocalStorage,
  createMemoryStorage,
  createProgress,
  defineLesson,
  isLessonComplete,
  lessonProgressFraction,
  type ModuleResult,
} from "../src";

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => {
      m.delete(k);
    },
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

const result = (id: string, score?: number): ModuleResult => ({
  moduleId: id,
  moduleType: "x",
  status: "completed",
  score,
  attempts: 1,
  durationMs: 10,
  completedAt: new Date().toISOString(),
});

describe("storage", () => {
  it("memory storage round-trips", async () => {
    const s = createMemoryStorage();
    const p = createProgress("l1");
    await s.save(p);
    expect(await s.load("l1")).toEqual(p);
    await s.clear("l1");
    expect(await s.load("l1")).toBeNull();
  });
  it("local storage falls back without window and uses custom Storage", async () => {
    const ssr = createLocalStorage();
    const p = createProgress("l1");
    await ssr.save(p);
    expect(await ssr.load("l1")).toEqual(p);

    const store = fakeStorage();
    const s = createLocalStorage({ storage: store, prefix: "t:" });
    await s.save(p);
    expect(store.getItem("t:l1")).toContain('"lessonId":"l1"');
    store.setItem("t:bad", "{not json");
    expect(await s.load("bad")).toBeNull();
  });
});

describe("lesson scoring", () => {
  const lesson = defineLesson({
    schemaVersion: 1,
    id: "l",
    title: "L",
    modules: [
      { id: "a", type: "story-cards", content: { cards: [{ body: "x" }] } },
      {
        id: "b",
        type: "true-false",
        scoring: { weight: 2 },
        content: { statements: [{ text: "x", isTrue: true }] },
      },
      {
        id: "c",
        type: "true-false",
        content: { statements: [{ text: "x", isTrue: true }] },
      },
    ],
  });
  it("computes weighted score, points and completion", () => {
    const results = { a: result("a"), b: result("b", 1), c: result("c", 0.4) };
    const s = computeLessonScore(lesson, results);
    expect(s.score).toBeCloseTo((2 * 1 + 0.4) / 3);
    expect(s.completedModules).toBe(3);
    expect(s.points).toBe(100 + 100 + 40);
    expect(s.passed).toBe(true);
    const progress = { ...createProgress("l"), results };
    expect(isLessonComplete(lesson, progress)).toBe(true);
    expect(
      lessonProgressFraction(lesson, { ...progress, results: { a: result("a") } }),
    ).toBeCloseTo(1 / 3);
  });
  it("applies the score threshold rule", () => {
    const strict = { ...lesson, completion: { rule: "score" as const, threshold: 0.9 } };
    const s = computeLessonScore(strict, {
      a: result("a"),
      b: result("b", 1),
      c: result("c", 0.4),
    });
    expect(s.passed).toBe(false);
  });
});

describe("createLocalStorage edge cases", () => {
  const progress = () => createProgress("lesson-1");
  const quota = (): Storage => ({
    length: 0,
    clear: () => {},
    getItem: () => null,
    key: () => null,
    removeItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new DOMException("quota", "QuotaExceededError");
    },
  });

  it("clears saved progress and ignores entries for another lesson or version", async () => {
    const store = fakeStorage();
    const s = createLocalStorage({ storage: store });
    await s.save(progress());
    expect(store.getItem("nibblearn:progress:lesson-1")).toBeTruthy();
    await s.clear("lesson-1");
    expect(await s.load("lesson-1")).toBeNull();

    store.setItem(
      "nibblearn:progress:lesson-1",
      JSON.stringify({ ...progress(), lessonId: "other" }),
    );
    expect(await s.load("lesson-1")).toBeNull();
    store.setItem("nibblearn:progress:lesson-1", JSON.stringify({ ...progress(), version: 99 }));
    expect(await s.load("lesson-1")).toBeNull();
    store.setItem("nibblearn:progress:lesson-1", "null");
    expect(await s.load("lesson-1")).toBeNull();
  });

  it("never throws when the browser blocks storage (quota, private mode)", async () => {
    const s = createLocalStorage({ storage: quota() });
    await expect(Promise.resolve(s.save(progress()))).resolves.toBeUndefined();
    await expect(Promise.resolve(s.clear("lesson-1"))).resolves.toBeUndefined();
    expect(await s.load("lesson-1")).toBeNull();
  });

  it("noopStorage persists nothing", async () => {
    const { noopStorage } = await import("../src");
    await noopStorage.save(progress());
    expect(await noopStorage.load("lesson-1")).toBeNull();
    await noopStorage.clear("lesson-1");
  });
});
