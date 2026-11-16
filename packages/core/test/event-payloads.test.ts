import { describe, expect, it } from "vitest";
import { createEvent, isEventOfType, validateEventPayload, type NibblearnEvent } from "../src";

describe("validateEventPayload", () => {
  it.each<NibblearnEvent>([
    createEvent("module:start", { moduleId: "m", moduleType: "x" }),
    createEvent("module:interact", { payload: { action: "flip", cardIndex: 2 } }),
    createEvent("module:answer", {
      payload: { itemIndex: 0, response: ["a"], correct: true, score: 1, extra: { any: 1 } },
    }),
    createEvent("module:answer", { payload: { response: { a: 1 } } }),
    createEvent("module:hint", { payload: { index: 1 } }),
    createEvent("module:complete", { payload: { score: 0.5, correct: 1, total: 2, attempts: 1 } }),
    createEvent("lesson:navigate", { lessonId: "l", payload: { from: 0, to: 1 } }),
    createEvent("lesson:complete", {
      lessonId: "l",
      payload: { score: 1, points: 100, passed: true },
    }),
    createEvent("lesson:resume", { lessonId: "l", payload: { index: 3 } }),
  ])("accepts $type", (event) => {
    expect(validateEventPayload(event).success).toBe(true);
  });

  it.each<[string, NibblearnEvent]>([
    ["interact without action", createEvent("module:interact", { payload: { x: 1 } })],
    [
      "answer with a non-boolean correct",
      createEvent("module:answer", { payload: { correct: "yes" } }),
    ],
    ["answer with score above 1", createEvent("module:answer", { payload: { score: 2 } })],
    ["complete without attempts", createEvent("module:complete", { payload: { score: 1 } })],
    ["navigate without indices", createEvent("lesson:navigate", { payload: {} })],
    ["unknown type", { type: "module:explode" as never, timestamp: "", payload: {} }],
    ["inherited type", { type: "toString" as never, timestamp: "" }],
  ])("rejects %s", (_name, event) => {
    const res = validateEventPayload(event);
    expect(res.success).toBe(false);
  });

  it("reports payload paths", () => {
    const res = validateEventPayload(createEvent("module:answer", { payload: { correct: 1 } }));
    expect(!res.success && res.issues[0]!.path).toBe("payload.correct");
  });
});

describe("isEventOfType", () => {
  it("narrows by type", () => {
    const event: NibblearnEvent = createEvent("module:answer", { payload: { correct: true } });
    if (isEventOfType(event, "module:answer")) {
      const correct: boolean | undefined = event.payload?.correct;
      expect(correct).toBe(true);
    } else throw new Error("expected an answer event");
    expect(isEventOfType(event, "module:complete")).toBe(false);
  });
});
