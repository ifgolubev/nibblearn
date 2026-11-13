import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

export const statementSchema = z.object({
  id: idSchema.optional(),
  text: textSchema,
  isTrue: z.boolean(),
  explanation: textSchema.optional(),
  image: mediaSchema.optional(),
  /** Small category label shown on the card. */
  tag: z.string().max(40).optional(),
});
export type Statement = z.infer<typeof statementSchema>;

export const trueFalseSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("true-false"),
  content: z.object({
    statements: z.array(statementSchema).min(1).max(100),
  }),
  behavior: z
    .object({
      /** Enable swipe gestures on touch and pointer devices. Buttons are always available. */
      swipe: z.boolean().default(true),
      trueLabel: z.string().max(24).default("True"),
      falseLabel: z.string().max(24).default("False"),
      /** Pause to show the explanation after each answer. */
      showExplanation: z.boolean().default(true),
      shuffle: z.boolean().default(false),
    })
    .default({
      swipe: true,
      trueLabel: "True",
      falseLabel: "False",
      showExplanation: true,
      shuffle: false,
    }),
});
export type TrueFalseConfig = z.infer<typeof trueFalseSchema>;
export type TrueFalseInput = z.input<typeof trueFalseSchema>;
