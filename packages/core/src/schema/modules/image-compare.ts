import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

const pct = z.number().min(0).max(100);

export const compareSideSchema = (defaultLabel: string) =>
  z.object({
    image: mediaSchema,
    /** Corner chip and slider value text, e.g. "Before". */
    label: z.string().trim().min(1).max(40).default(defaultLabel),
  });

export const compareAnnotationSchema = z.object({
  id: idSchema,
  /** Horizontal position as a percentage of the image width (0–100). */
  x: pct,
  /** Vertical position as a percentage of the image height (0–100). */
  y: pct,
  /** Which image the note belongs to; it is visible only while that side is revealed. */
  side: z.enum(["before", "after"]),
  title: z.string().min(1).max(120),
  text: textSchema,
});
export type CompareAnnotation = z.infer<typeof compareAnnotationSchema>;

export const compareOptionSchema = z.object({
  id: idSchema.optional(),
  text: textSchema,
  correct: z.boolean().default(false),
  explanation: textSchema.optional(),
});
export type CompareOption = z.infer<typeof compareOptionSchema>;

export const compareQuestionSchema = z.object({
  prompt: textSchema,
  /** 2–5 options, at least one correct. More than one correct = select all that apply. */
  options: z.array(compareOptionSchema).min(2).max(5),
  explanation: textSchema.optional(),
});
export type CompareQuestion = z.infer<typeof compareQuestionSchema>;

export const imageCompareSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("image-compare"),
    content: z.object({
      before: compareSideSchema("Before"),
      after: compareSideSchema("After"),
      annotations: z.array(compareAnnotationSchema).max(8).default([]),
      /** Optional knowledge check shown once the learner has explored. */
      question: compareQuestionSchema.optional(),
      /** Key message on the completion card. */
      takeaway: textSchema.optional(),
    }),
    behavior: z
      .object({
        /** Starting divider position: percent of the width showing the "before" image. */
        initialPosition: pct.default(50),
        /**
         * The learner must drag to ≤ 15% and ≥ 85% at least once (or open every
         * annotation) before the question or completion appears.
         */
        requireExplore: z.boolean().default(true),
      })
      .default({ initialPosition: 50, requireExplore: true }),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    cfg.content.annotations.forEach((a, i) => {
      if (ids.has(a.id))
        ctx.addIssue({
          code: "custom",
          path: ["content", "annotations", i, "id"],
          message: `duplicate annotation id "${a.id}"`,
        });
      ids.add(a.id);
    });
    const q = cfg.content.question;
    if (q) {
      if (!q.options.some((o) => o.correct))
        ctx.addIssue({
          code: "custom",
          path: ["content", "question", "options"],
          message: "at least one option must be correct",
        });
      const optionIds = new Set<string>();
      q.options.forEach((o, i) => {
        if (o.id === undefined) return;
        if (optionIds.has(o.id))
          ctx.addIssue({
            code: "custom",
            path: ["content", "question", "options", i, "id"],
            message: `duplicate option id "${o.id}"`,
          });
        optionIds.add(o.id);
      });
    }
  });
export type ImageCompareConfig = z.infer<typeof imageCompareSchema>;
export type ImageCompareInput = z.input<typeof imageCompareSchema>;
