import { describe, expect, it, vi } from "vitest";
import {
  createEvent,
  createXapiAdapter,
  eventToXapiStatements,
  toIsoDuration,
  type XapiOptions,
} from "../src";

const options: XapiOptions = {
  actor: { name: "Learner", mbox: "mailto:learner@example.com" },
  activityBaseIri: "https://learn.example.com/xapi/",
  lesson: { id: "metrics", title: "Marketing metrics" },
  module: { id: "quiz", type: "choice-challenge", title: "KPI quiz", passThreshold: 0.7 },
  registration: "6f1f4c7e-9b8a-4d36-a7c2-2d6c2f0d9a11",
};

const at = "2026-11-15T10:00:00.000Z";
const ev = (
  type: Parameters<typeof createEvent>[0],
  data: Parameters<typeof createEvent>[1] = {},
) => ({
  ...createEvent(type, data),
  timestamp: at,
});

describe("eventToXapiStatements", () => {
  it("maps lesson start and resume", () => {
    const [start] = eventToXapiStatements(ev("lesson:start", { lessonId: "metrics" }), options);
    expect(start).toMatchObject({
      actor: { objectType: "Agent", mbox: "mailto:learner@example.com" },
      verb: { id: "http://adlnet.gov/expapi/verbs/initialized" },
      object: {
        id: "https://learn.example.com/xapi/metrics",
        definition: {
          type: "http://adlnet.gov/expapi/activities/lesson",
          name: { en: "Marketing metrics" },
        },
      },
      context: { registration: options.registration },
      timestamp: at,
    });
    expect(
      eventToXapiStatements(ev("lesson:resume", { lessonId: "metrics" }), options)[0]!.verb.id,
    ).toMatch(/resumed$/);
  });

  it("maps answers with success and a string response, inside the lesson", () => {
    const [s] = eventToXapiStatements(
      ev("module:answer", {
        lessonId: "metrics",
        moduleId: "quiz",
        moduleType: "choice-challenge",
        payload: { itemIndex: 0, response: ["opt1"], correct: false, score: 0.5 },
      }),
      options,
    );
    expect(s!.verb.id).toBe("http://adlnet.gov/expapi/verbs/answered");
    expect(s!.object.id).toBe("https://learn.example.com/xapi/metrics/quiz");
    expect(s!.object.definition.type).toBe("http://adlnet.gov/expapi/activities/assessment");
    expect(s!.result).toEqual({ success: false, response: '["opt1"]', score: { scaled: 0.5 } });
    expect(s!.context!.contextActivities!.parent).toEqual([
      { objectType: "Activity", id: "https://learn.example.com/xapi/metrics" },
    ]);
  });

  it("adds passed or failed to a scored completion using the module threshold", () => {
    const complete = (score: number) =>
      eventToXapiStatements(
        ev("module:complete", {
          lessonId: "metrics",
          moduleId: "quiz",
          payload: { score, correct: 2, total: 3, attempts: 1, durationMs: 12345 },
        }),
        options,
      );
    const passed = complete(0.8);
    expect(passed.map((s) => s.verb.id.split("/").pop())).toEqual(["completed", "passed"]);
    expect(passed[0]!.result).toMatchObject({
      completion: true,
      duration: "PT12.35S",
      score: { scaled: 0.8, raw: 2, min: 0, max: 3 },
    });
    expect(complete(0.5).map((s) => s.verb.id.split("/").pop())).toEqual(["completed", "failed"]);
  });

  it("uses the lesson result for passed / failed", () => {
    const out = eventToXapiStatements(
      ev("lesson:complete", {
        lessonId: "metrics",
        payload: { score: 0.9, points: 300, passed: true },
      }),
      options,
    );
    expect(out.map((s) => s.verb.id.split("/").pop())).toEqual(["completed", "passed"]);
  });

  it("skips interactions unless asked, and resets always", () => {
    const interact = ev("module:interact", { moduleId: "quiz", payload: { action: "select" } });
    expect(eventToXapiStatements(interact, options)).toEqual([]);
    const [s] = eventToXapiStatements(interact, { ...options, includeInteractions: true });
    expect(s!.verb.id).toMatch(/interacted$/);
    expect(eventToXapiStatements(ev("module:reset", { moduleId: "quiz" }), options)).toEqual([]);
  });

  it("follows cmi5: defined statements for the AU, allowed statements for modules", () => {
    const cmi5 = {
      ...options,
      cmi5: { sessionId: "sess-1", masteryScore: 0.6, activityId: "https://lms.example/au/42" },
    };
    const CAT = "https://w3id.org/xapi/cmi5/context/categories/";
    const EXT5 = "https://w3id.org/xapi/cmi5/context/extensions/";
    const cats = (s: { context?: { contextActivities?: { category?: { id: string }[] } } }) =>
      (s.context?.contextActivities?.category ?? []).map((c) => c.id);

    // Module statements: "cmi5 allowed" (no cmi5 / moveon category), with the session id.
    const moduleStatements = [
      ...eventToXapiStatements(
        ev("module:complete", { moduleId: "other", payload: { score: 0.65, attempts: 1 } }),
        cmi5,
      ),
      ...eventToXapiStatements(ev("module:answer", { moduleId: "q", payload: {} }), cmi5),
    ];
    for (const st of moduleStatements) {
      expect(cats(st)).toEqual([]);
      expect(st.context!.extensions![`${EXT5}sessionid`]).toBe("sess-1");
    }

    // Lesson statements: "cmi5 defined", about the AU.
    const [initialized] = eventToXapiStatements(ev("lesson:start"), cmi5);
    expect(cats(initialized!)).toEqual([`${CAT}cmi5`]);
    expect(initialized!.object.id).toBe("https://lms.example/au/42");

    const [completed, passed] = eventToXapiStatements(
      ev("lesson:complete", {
        payload: { score: 0.8, points: 8, passed: true, durationMs: 61_000 },
      }),
      cmi5,
    );
    expect(cats(completed!)).toEqual([`${CAT}cmi5`, `${CAT}moveon`]);
    expect(completed!.result!.duration).toBe("PT1M1S");
    expect(completed!.context!.extensions![`${EXT5}masteryscore`]).toBeUndefined();
    expect(passed!.verb.id).toMatch(/passed$/);
    expect(cats(passed!)).toEqual([`${CAT}cmi5`, `${CAT}moveon`]);
    expect(passed!.result!.duration).toBe("PT1M1S");
    expect(passed!.context!.extensions![`${EXT5}masteryscore`]).toBe(0.6);
  });

  it("validates options", () => {
    expect(() =>
      eventToXapiStatements(ev("lesson:start"), { ...options, activityBaseIri: "learn" }),
    ).toThrow(TypeError);
    expect(() =>
      eventToXapiStatements(ev("lesson:start"), {
        ...options,
        actor: { mbox: "mailto:a@example.com", account: { homePage: "https://x", name: "a" } },
      }),
    ).toThrow(TypeError);
  });
});

describe("helpers", () => {
  it.each([
    [12345, "PT12.35S"],
    [0, "PT0S"],
    [61000, "PT1M1S"],
    [3600000, "PT1H"],
    [3723400, "PT1H2M3.4S"],
  ])("toIsoDuration(%d) = %s", (ms, iso) => {
    expect(toIsoDuration(ms)).toBe(iso);
  });

  it("the adapter sends every statement", () => {
    const send = vi.fn();
    const adapter = createXapiAdapter({ ...options, send });
    adapter.track(ev("module:complete", { moduleId: "quiz", payload: { score: 1, attempts: 1 } }));
    expect(send).toHaveBeenCalledTimes(2);
  });
});
