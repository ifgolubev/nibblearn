import { z } from "zod";
import type { NibblearnEvent, NibblearnEventType } from "./events";
import { issuesFromZod, type ValidationResult } from "./validate";

/**
 * Payload schemas of built-in events. Modules may add extra keys (all object schemas are
 * loose); the keys below are the stable, documented part.
 */
const emptyPayload = z.looseObject({});

export const moduleCompletePayloadSchema = z.looseObject({
  score: z.number().min(0).max(1).optional(),
  correct: z.number().optional(),
  total: z.number().optional(),
  attempts: z.number(),
  durationMs: z.number().min(0).optional(),
});

export const moduleAnswerPayloadSchema = z.looseObject({
  /** Id of the answered item (question, card, message…), when items have ids. */
  itemId: z.string().optional(),
  /** Index of the answered item, when the module is item based. */
  itemIndex: z.number().int().optional(),
  /** The learner's response, JSON-serialisable. */
  response: z.unknown().optional(),
  /** Whether the response was correct, when the module has a notion of correctness. */
  correct: z.boolean().optional(),
  /** 0–1 credit for this response, when partial credit applies. */
  score: z.number().min(0).max(1).optional(),
  attempts: z.number().int().optional(),
});

export const moduleInteractPayloadSchema = z.looseObject({
  /** What happened, e.g. "open", "select", "move", "place", "flip". */
  action: z.string(),
});

export const moduleHintPayloadSchema = z.looseObject({});

export const lessonResumePayloadSchema = z.looseObject({ index: z.number().int() });
export const lessonNavigatePayloadSchema = z.looseObject({
  from: z.number().int(),
  to: z.number().int(),
});
export const lessonCompletePayloadSchema = z.looseObject({
  score: z.number().min(0).max(1),
  points: z.number(),
  passed: z.boolean(),
  /** Time since the lesson attempt started (ms). */
  durationMs: z.number().min(0).optional(),
});

export const eventPayloadSchemas = {
  "lesson:start": emptyPayload,
  "lesson:resume": lessonResumePayloadSchema,
  "lesson:navigate": lessonNavigatePayloadSchema,
  "lesson:complete": lessonCompletePayloadSchema,
  "lesson:reset": emptyPayload,
  "module:start": emptyPayload,
  "module:interact": moduleInteractPayloadSchema,
  "module:answer": moduleAnswerPayloadSchema,
  "module:hint": moduleHintPayloadSchema,
  "module:complete": moduleCompletePayloadSchema,
  "module:reset": emptyPayload,
} as const satisfies Record<NibblearnEventType, z.ZodType>;

/** Payload type of each built-in event. */
export type NibblearnEventPayloads = {
  [K in NibblearnEventType]: z.infer<(typeof eventPayloadSchemas)[K]>;
};

/** `NibblearnEvent` narrowed by `type`, with a typed payload. */
export type TypedNibblearnEvent = {
  [K in NibblearnEventType]: Omit<NibblearnEvent, "type" | "payload"> & {
    type: K;
    payload?: NibblearnEventPayloads[K];
  };
}[NibblearnEventType];

/** Narrow an event to one type. The payload is trusted to match (built-in modules do). */
export function isEventOfType<K extends NibblearnEventType>(
  event: NibblearnEvent,
  type: K,
): event is NibblearnEvent & Extract<TypedNibblearnEvent, { type: K }> {
  return event.type === type;
}

/**
 * Check an event's payload against its documented schema, e.g. before sending it to an
 * analytics or LMS backend. Events without a payload are valid; unknown types are rejected.
 */
export function validateEventPayload(event: NibblearnEvent): ValidationResult<NibblearnEvent> {
  if (!Object.prototype.hasOwnProperty.call(eventPayloadSchemas, event.type))
    return {
      success: false,
      issues: [{ path: "type", message: `unknown event type "${event.type}"` }],
    };
  if (event.payload === undefined) return { success: true, data: event, issues: [] };
  const res = eventPayloadSchemas[event.type].safeParse(event.payload);
  if (res.success) return { success: true, data: event, issues: [] };
  return { success: false, issues: issuesFromZod(res.error, ["payload"]) };
}
