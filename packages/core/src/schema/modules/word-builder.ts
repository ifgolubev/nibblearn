import { z } from "zod";
import { idSchema, moduleBaseShape, retryBehaviorShape, textSchema } from "../common";

/** One tile of text. Leading/trailing whitespace is not allowed to carry meaning. */
export const wordTokenSchema = z
  .string()
  .max(60)
  .refine((s) => s.trim().length > 0, "tokens must not be empty");

export const wordBuilderItemSchema = z.object({
  id: idSchema.optional(),
  /** What to build, e.g. "Build the formula for ROAS." */
  prompt: textSchema,
  /** The correct answer, one tile per token, in order. */
  tokens: z.array(wordTokenSchema).min(2).max(14),
  /** Other accepted orders. Each must use exactly the same tokens as `tokens`. */
  alternatives: z.array(z.array(wordTokenSchema).min(2).max(14)).max(10).optional(),
  /** Extra tiles that do not belong in the answer. */
  distractors: z.array(wordTokenSchema).max(10).default([]),
  /** "formula" renders tiles in the display face and highlights operators (=, ÷, ×, +, −). */
  display: z.enum(["sentence", "formula"]).default("sentence"),
  hint: textSchema.optional(),
  explanation: textSchema.optional(),
});
export type WordBuilderItem = z.infer<typeof wordBuilderItemSchema>;

function multisetKey(tokens: readonly string[]): string {
  return tokens
    .map((t) => t.trim())
    .sort()
    .join("\u0000");
}

export const wordBuilderSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("word-builder"),
    content: z.object({
      items: z.array(wordBuilderItemSchema).min(1).max(10),
    }),
    behavior: z
      .object({
        ...retryBehaviorShape,
        /** Seed for the tile shuffle (deterministic order). */
        shuffleSeed: z.number().int().optional(),
        /** Show "Item 2 of 4" and a progress bar. */
        showCounter: z.boolean().default(true),
      })
      .default({ allowRetry: true, maxAttempts: 0, showExplanation: true, showCounter: true }),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    cfg.content.items.forEach((item, i) => {
      const path = ["content", "items", i];
      if (item.id !== undefined) {
        if (ids.has(item.id))
          ctx.addIssue({
            code: "custom",
            path: [...path, "id"],
            message: `duplicate item id "${item.id}"`,
          });
        ids.add(item.id);
      }
      const key = multisetKey(item.tokens);
      item.alternatives?.forEach((alt, j) => {
        if (multisetKey(alt) !== key)
          ctx.addIssue({
            code: "custom",
            path: [...path, "alternatives", j],
            message: "alternatives must use exactly the same tokens as `tokens`, in another order",
          });
      });
    });
  });
export type WordBuilderConfig = z.infer<typeof wordBuilderSchema>;
export type WordBuilderInput = z.input<typeof wordBuilderSchema>;
