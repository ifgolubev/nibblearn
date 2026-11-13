import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

const pct = z.number().min(0).max(100);

/** A selectable region on an image, in percentages. */
export const imageRegionSchema = z.object({
  id: idSchema,
  label: z.string().max(80),
  x: pct,
  y: pct,
  width: pct,
  height: pct,
});

/** A row of a mock document (label/value pair). */
export const documentRowSchema = z.object({
  id: idSchema,
  label: z.string().max(80),
  value: z.string().max(200),
  /** Optional secondary text under the value. */
  note: z.string().max(160).optional(),
  /** Visually group rows into sections. */
  section: z.string().max(80).optional(),
});

export const mistakeSchema = z.object({
  /** Id of the region or document row that contains the mistake. */
  targetId: idSchema,
  /** Short name of the problem, e.g. "Wrong currency". */
  title: z.string().max(100).optional(),
  explanation: textSchema,
  /** Hint revealed on demand. */
  hint: textSchema.optional(),
});
export type Mistake = z.infer<typeof mistakeSchema>;

export const spotTheMistakeSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("spot-the-mistake"),
    content: z.object({
      /** Either an image with regions, or a mock document with rows. */
      canvas: z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("image"),
          image: mediaSchema,
          regions: z.array(imageRegionSchema).min(2).max(40),
        }),
        z.object({
          kind: z.literal("document"),
          title: z.string().max(120),
          subtitle: z.string().max(160).optional(),
          rows: z.array(documentRowSchema).min(2).max(40),
        }),
      ]),
      mistakes: z.array(mistakeSchema).min(1).max(20),
      /** Shown on the final explanation screen. */
      summary: textSchema.optional(),
    }),
    behavior: z
      .object({
        /** Wrong selections allowed before the module ends. 0 = unlimited. */
        maxWrong: z.number().int().min(0).default(0),
        allowHints: z.boolean().default(true),
        allowRetry: z.boolean().default(true),
        /** Check selections one at a time ("instant") or all at once ("submit"). */
        checkMode: z.enum(["instant", "submit"]).default("instant"),
      })
      .default({ maxWrong: 0, allowHints: true, allowRetry: true, checkMode: "instant" }),
  })
  .superRefine((cfg, ctx) => {
    const targets = new Set(
      cfg.content.canvas.kind === "image"
        ? cfg.content.canvas.regions.map((r) => r.id)
        : cfg.content.canvas.rows.map((r) => r.id),
    );
    cfg.content.mistakes.forEach((m, i) => {
      if (!targets.has(m.targetId))
        ctx.addIssue({
          code: "custom",
          path: ["content", "mistakes", i, "targetId"],
          message: `mistake refers to unknown target "${m.targetId}"`,
        });
    });
  });
export type SpotTheMistakeConfig = z.infer<typeof spotTheMistakeSchema>;
export type SpotTheMistakeInput = z.input<typeof spotTheMistakeSchema>;
