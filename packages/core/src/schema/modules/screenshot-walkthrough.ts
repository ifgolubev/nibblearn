import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

const pct = z.number().min(0).max(100);

export const walkthroughStepSchema = z.object({
  id: idSchema,
  /** Screenshot for this step. Reuse the same image across steps when nothing changes. */
  image: mediaSchema,
  title: z.string().max(120).optional(),
  /** What the learner should do, e.g. "Click Contacts in the sidebar". */
  instruction: textSchema,
  /** Target region as percentages of the image. */
  target: z.object({ x: pct, y: pct, width: pct, height: pct }),
  /** "click": learner must click the target. "type": learner types into a simulated field. "observe": just read and continue. */
  action: z.enum(["click", "type", "observe"]).default("click"),
  /** For "type" actions: the simulated input. */
  input: z
    .object({
      placeholder: z.string().max(80).optional(),
      /** Expected text (case-insensitive). Any text accepted when omitted. */
      expected: z.string().max(120).optional(),
    })
    .optional(),
  /** Extra context shown in the tooltip. */
  note: textSchema.optional(),
  tooltipPlacement: z.enum(["auto", "top", "bottom", "left", "right"]).default("auto"),
});
export type WalkthroughStep = z.infer<typeof walkthroughStepSchema>;

export const screenshotWalkthroughSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("screenshot-walkthrough"),
  content: z.object({
    steps: z.array(walkthroughStepSchema).min(1).max(40),
    /** Message shown on the completion screen. */
    summary: textSchema.optional(),
  }),
  behavior: z
    .object({
      /** Show a "Show me" button that highlights the target after a miss. */
      allowHint: z.boolean().default(true),
      /** Number of misses before the target is highlighted automatically. 0 = never. */
      autoHintAfterMisses: z.number().int().min(0).default(2),
      showStepNumbers: z.boolean().default(true),
      allowBack: z.boolean().default(true),
    })
    .default({ allowHint: true, autoHintAfterMisses: 2, showStepNumbers: true, allowBack: true }),
});
export type ScreenshotWalkthroughConfig = z.infer<typeof screenshotWalkthroughSchema>;
export type ScreenshotWalkthroughInput = z.input<typeof screenshotWalkthroughSchema>;
