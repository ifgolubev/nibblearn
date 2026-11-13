import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

export const processStageSchema = z.object({
  id: idSchema,
  title: z.string().max(100),
  /** One-line summary shown on the stage node. */
  summary: z.string().max(200).optional(),
  /** Full explanation shown in the detail panel. */
  details: textSchema,
  /** Lucide icon name (kebab-case), e.g. "rocket". Falls back to a number when unknown. */
  icon: z.string().max(40).optional(),
  /** Who owns the stage, e.g. "Account team". */
  owner: z.string().max(80).optional(),
  /** Typical duration label, e.g. "2–3 days". */
  duration: z.string().max(40).optional(),
  /** Ids of stages that must happen before this one. */
  dependsOn: z.array(idSchema).default([]),
  /** Optional alternative paths from this stage. */
  branches: z.array(z.object({ label: z.string().max(80), to: idSchema })).default([]),
  /** Optional checklist of sub-steps. */
  checklist: z.array(z.string().max(160)).default([]),
  image: mediaSchema.optional(),
});
export type ProcessStage = z.infer<typeof processStageSchema>;

export const processExplorerSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("process-explorer"),
    content: z.object({
      stages: z.array(processStageSchema).min(2).max(20),
    }),
    behavior: z
      .object({
        /** "auto" uses horizontal on wide screens and vertical on narrow ones. */
        layout: z.enum(["auto", "horizontal", "vertical"]).default("auto"),
        /** Complete only after every stage has been opened. */
        requireAll: z.boolean().default(true),
      })
      .default({ layout: "auto", requireAll: true }),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.content.stages.map((s) => s.id));
    cfg.content.stages.forEach((s, i) => {
      s.dependsOn.forEach((d, j) => {
        if (!ids.has(d))
          ctx.addIssue({
            code: "custom",
            path: ["content", "stages", i, "dependsOn", j],
            message: `stage "${s.id}" depends on unknown stage "${d}"`,
          });
      });
      s.branches.forEach((b, j) => {
        if (!ids.has(b.to))
          ctx.addIssue({
            code: "custom",
            path: ["content", "stages", i, "branches", j, "to"],
            message: `branch "${b.label}" points to unknown stage "${b.to}"`,
          });
      });
    });
  });
export type ProcessExplorerConfig = z.infer<typeof processExplorerSchema>;
export type ProcessExplorerInput = z.input<typeof processExplorerSchema>;
