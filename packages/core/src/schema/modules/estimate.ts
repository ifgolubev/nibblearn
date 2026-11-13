import { z } from "zod";
import { idSchema, moduleBaseShape, textSchema } from "../common";

export const estimateFormatSchema = z
  .enum(["number", "percent", "currency", "integer"])
  .default("number");

export const estimateQuestionSchema = z.object({
  id: idSchema.optional(),
  /** The question, e.g. "What was the account-wide CTR in March?" */
  prompt: textSchema,
  /** Optional supporting line shown under the prompt. */
  context: textSchema.optional(),
  /** Lowest value on the scale. */
  min: z.number(),
  /** Highest value on the scale. */
  max: z.number(),
  /** Slider increment. */
  step: z.number().positive().default(1),
  /** The true value; must be within [min, max]. */
  answer: z.number(),
  /** "percent" values are fractions (0.028 = 2.8%). */
  format: estimateFormatSchema,
  /** Suffix label, e.g. "×" or "clicks". */
  unit: z.string().max(24).optional(),
  /**
   * Absolute distance from the answer that still counts as a bullseye.
   * Defaults to 5% of the range. Within 3× tolerance counts as "close".
   */
  tolerance: z.number().positive().optional(),
  explanation: textSchema.optional(),
  hint: textSchema.optional(),
});
export type EstimateQuestion = z.infer<typeof estimateQuestionSchema>;

export const estimateSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("estimate"),
    content: z.object({
      questions: z.array(estimateQuestionSchema).min(1).max(20),
      /** Currency code for "currency" formatting. */
      currency: z.string().length(3).default("USD"),
    }),
    behavior: z
      .object({
        /** Show "Question 2 of 5" and a progress bar. */
        showCounter: z.boolean().default(true),
      })
      .default({ showCounter: true }),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    cfg.content.questions.forEach((q, i) => {
      const path = ["content", "questions", i];
      if (q.id !== undefined) {
        if (ids.has(q.id))
          ctx.addIssue({
            code: "custom",
            path: [...path, "id"],
            message: `duplicate question id "${q.id}"`,
          });
        ids.add(q.id);
      }
      if (q.min >= q.max) {
        ctx.addIssue({
          code: "custom",
          path: [...path, "max"],
          message: "max must be greater than min",
        });
        return;
      }
      if (q.answer < q.min || q.answer > q.max)
        ctx.addIssue({
          code: "custom",
          path: [...path, "answer"],
          message: `answer must be within [min, max] (${q.min}–${q.max})`,
        });
      if (q.step > q.max - q.min)
        ctx.addIssue({
          code: "custom",
          path: [...path, "step"],
          message: "step must not be larger than the range",
        });
      if (q.tolerance !== undefined && q.tolerance > q.max - q.min)
        ctx.addIssue({
          code: "custom",
          path: [...path, "tolerance"],
          message: "tolerance must not be larger than the range",
        });
    });
  });
export type EstimateConfig = z.infer<typeof estimateSchema>;
export type EstimateInput = z.input<typeof estimateSchema>;
