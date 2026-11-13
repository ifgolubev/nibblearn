import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, retryBehaviorShape, textSchema } from "../common";

const pct = z.number().min(0).max(100);
const labelText = z.string().trim().min(1).max(80);

export const labelTargetSchema = z.object({
  id: idSchema,
  /** Horizontal anchor point as a percentage of the image width (0–100). */
  x: pct,
  /** Vertical anchor point as a percentage of the image height (0–100). */
  y: pct,
  /** The correct label for this point. Unique across targets and distractors. */
  label: labelText,
  /** Why this part matters; shown after checking. */
  explanation: textSchema.optional(),
});
export type LabelTarget = z.infer<typeof labelTargetSchema>;

export const labelDiagramSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("label-diagram"),
    content: z.object({
      /** The diagram. Provide width/height so anchors line up before the image loads. */
      image: mediaSchema,
      targets: z.array(labelTargetSchema).min(2).max(12),
      /** Extra labels that belong nowhere. */
      distractors: z.array(labelText).max(8).default([]),
      /** Shown on the completion card. */
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
    const ids = new Set<string>();
    const labels = new Set<string>();
    const seen = (label: string, path: (string | number)[]) => {
      const key = label.trim().toLowerCase();
      if (labels.has(key))
        ctx.addIssue({ code: "custom", path, message: `duplicate label "${label}"` });
      labels.add(key);
    };
    cfg.content.targets.forEach((target, i) => {
      if (ids.has(target.id))
        ctx.addIssue({
          code: "custom",
          path: ["content", "targets", i, "id"],
          message: `duplicate target id "${target.id}"`,
        });
      ids.add(target.id);
      seen(target.label, ["content", "targets", i, "label"]);
    });
    cfg.content.distractors.forEach((label, i) => seen(label, ["content", "distractors", i]));
  });
export type LabelDiagramConfig = z.infer<typeof labelDiagramSchema>;
export type LabelDiagramInput = z.input<typeof labelDiagramSchema>;
