import { z } from "zod";
import { idSchema, moduleBaseShape, retryBehaviorShape, textSchema } from "../common";

export const sequenceItemSchema = z.object({
  id: idSchema,
  text: textSchema,
  /** Shown in the solution view to explain why this step comes here. */
  description: textSchema.optional(),
});
export type SequenceItem = z.infer<typeof sequenceItemSchema>;

export const sequenceBuilderSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("sequence-builder"),
  content: z.object({
    /** Items listed in the CORRECT order. They are shuffled for the learner. */
    items: z.array(sequenceItemSchema).min(2).max(15),
    /** Shown with the correct sequence after checking. */
    explanation: textSchema.optional(),
    hint: textSchema.optional(),
  }),
  behavior: z
    .object({
      ...retryBehaviorShape,
      /** Seed for deterministic shuffling. Random when omitted. */
      shuffleSeed: z.number().int().optional(),
      /** Show numbered positions next to the items. */
      showPositions: z.boolean().default(true),
    })
    .default({ allowRetry: true, maxAttempts: 0, showExplanation: true, showPositions: true }),
});
export type SequenceBuilderConfig = z.infer<typeof sequenceBuilderSchema>;
export type SequenceBuilderInput = z.input<typeof sequenceBuilderSchema>;
