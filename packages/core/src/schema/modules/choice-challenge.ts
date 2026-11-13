import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, retryBehaviorShape, textSchema } from "../common";

export const choiceOptionSchema = z.object({
  id: idSchema.optional(),
  text: textSchema,
  image: mediaSchema.optional(),
  correct: z.boolean().default(false),
  /** Explanation shown for this specific option after checking. */
  explanation: textSchema.optional(),
});
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;

export const choiceQuestionSchema = z
  .object({
    id: idSchema.optional(),
    prompt: textSchema,
    /** Secondary context shown under the prompt. */
    context: textSchema.optional(),
    image: mediaSchema.optional(),
    /** "single": exactly one correct option. "multiple": one or more. Inferred when omitted. */
    mode: z.enum(["single", "multiple"]).optional(),
    options: z.array(choiceOptionSchema).min(2).max(8),
    /** General explanation shown after checking. */
    explanation: textSchema.optional(),
    hint: textSchema.optional(),
  })
  .refine((q) => q.options.some((o) => o.correct), {
    message: "each question needs at least one correct option",
    path: ["options"],
  });
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;

export const choiceChallengeSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("choice-challenge"),
  content: z.object({
    questions: z.array(choiceQuestionSchema).min(1).max(50),
  }),
  behavior: z
    .object({
      ...retryBehaviorShape,
      shuffleOptions: z.boolean().default(false),
      /** Award partial credit for partially correct multiple-choice answers. */
      partialCredit: z.boolean().default(true),
      /** Show the question counter ("2 of 5"). */
      showCounter: z.boolean().default(true),
    })
    .default({
      allowRetry: true,
      maxAttempts: 0,
      showExplanation: true,
      shuffleOptions: false,
      partialCredit: true,
      showCounter: true,
    }),
});
export type ChoiceChallengeConfig = z.infer<typeof choiceChallengeSchema>;
export type ChoiceChallengeInput = z.input<typeof choiceChallengeSchema>;
