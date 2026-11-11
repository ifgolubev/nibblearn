import { z } from "zod";
import {
  idSchema,
  moduleBaseShape,
  retryBehaviorShape,
  textSchema,
  cssColorSchema,
} from "../common";

export const matrixAxisSchema = z.object({
  /** Axis name, e.g. "Urgency". */
  label: z.string().min(1).max(60),
  /** Label for the low end, e.g. "low". */
  low: z.string().min(1).max(40),
  /** Label for the high end, e.g. "high". */
  high: z.string().min(1).max(40),
});
export type MatrixAxis = z.infer<typeof matrixAxisSchema>;

export const quadrantPositionSchema = z.enum([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);
export type QuadrantPosition = z.infer<typeof quadrantPositionSchema>;

export const matrixQuadrantSchema = z.object({
  id: idSchema,
  /** Where the quadrant sits: top = high on the y axis, right = high on the x axis. */
  position: quadrantPositionSchema,
  /** Short label shown in the display face, e.g. "Do now". */
  label: z.string().min(1).max(40),
  description: textSchema.optional(),
  /** Token ("accent" | "lime" | "pink" | "sky" | "violet") or any CSS colour. */
  color: cssColorSchema.optional(),
});
export type MatrixQuadrant = z.infer<typeof matrixQuadrantSchema>;

export const matrixItemSchema = z.object({
  id: idSchema,
  text: textSchema,
  /** The id of the quadrant this item belongs in. */
  quadrantId: idSchema,
  explanation: textSchema.optional(),
});
export type MatrixItem = z.infer<typeof matrixItemSchema>;

export const priorityMatrixSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("priority-matrix"),
    content: z.object({
      axes: z.object({ x: matrixAxisSchema, y: matrixAxisSchema }),
      quadrants: z.array(matrixQuadrantSchema).length(4),
      items: z.array(matrixItemSchema).min(3).max(16),
      explanation: textSchema.optional(),
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
    const quadrantIds = new Set<string>();
    const positions = new Set<string>();
    cfg.content.quadrants.forEach((q, i) => {
      const path = ["content", "quadrants", i];
      if (quadrantIds.has(q.id))
        ctx.addIssue({
          code: "custom",
          path: [...path, "id"],
          message: `duplicate quadrant id "${q.id}"`,
        });
      quadrantIds.add(q.id);
      if (positions.has(q.position))
        ctx.addIssue({
          code: "custom",
          path: [...path, "position"],
          message: `position "${q.position}" is used by more than one quadrant; use each of top-left, top-right, bottom-left and bottom-right once`,
        });
      positions.add(q.position);
    });
    const itemIds = new Set<string>();
    cfg.content.items.forEach((item, i) => {
      const path = ["content", "items", i];
      if (itemIds.has(item.id))
        ctx.addIssue({
          code: "custom",
          path: [...path, "id"],
          message: `duplicate item id "${item.id}"`,
        });
      itemIds.add(item.id);
      if (!quadrantIds.has(item.quadrantId))
        ctx.addIssue({
          code: "custom",
          path: [...path, "quadrantId"],
          message: `item "${item.id}" refers to unknown quadrant "${item.quadrantId}"`,
        });
    });
  });
export type PriorityMatrixConfig = z.infer<typeof priorityMatrixSchema>;
export type PriorityMatrixInput = z.input<typeof priorityMatrixSchema>;
