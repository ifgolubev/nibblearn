import { z } from "zod";
import {
  idSchema,
  moduleBaseShape,
  retryBehaviorShape,
  textSchema,
  cssColorSchema,
} from "../common";

export const categorySchema = z.object({
  id: idSchema,
  label: z.string().max(80),
  description: textSchema.optional(),
  /** Optional color token: "accent" | "success" | "info" | "warning" or any CSS color. */
  color: cssColorSchema.optional(),
});
export type Category = z.infer<typeof categorySchema>;

export const sortItemSchema = z.object({
  id: idSchema,
  text: textSchema,
  /** The id of the category this item belongs to. */
  categoryId: idSchema,
  explanation: textSchema.optional(),
});
export type SortItem = z.infer<typeof sortItemSchema>;

export const categorySortSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("category-sort"),
    content: z.object({
      categories: z.array(categorySchema).min(2).max(6),
      items: z.array(sortItemSchema).min(2).max(40),
      hint: textSchema.optional(),
    }),
    behavior: z
      .object({
        ...retryBehaviorShape,
        shuffle: z.boolean().default(true),
        shuffleSeed: z.number().int().optional(),
      })
      .default({ allowRetry: true, maxAttempts: 0, showExplanation: true, shuffle: true }),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.content.categories.map((c) => c.id));
    cfg.content.items.forEach((item, i) => {
      if (!ids.has(item.categoryId)) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "items", i, "categoryId"],
          message: `item "${item.id}" refers to unknown category "${item.categoryId}"`,
        });
      }
    });
  });
export type CategorySortConfig = z.infer<typeof categorySortSchema>;
export type CategorySortInput = z.input<typeof categorySortSchema>;
