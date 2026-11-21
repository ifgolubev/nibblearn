import { z } from "zod";
import {
  idSchema,
  linkHrefSchema,
  mediaSchema,
  moduleBaseShape,
  textSchema,
  videoSchema,
} from "../common";

export const storyCardCheckSchema = z.object({
  question: textSchema,
  options: z
    .array(
      z.object({
        text: textSchema,
        correct: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(6),
  explanation: textSchema.optional(),
});

export const storyCardSchema = z.object({
  id: idSchema.optional(),
  /** Small label above the title, e.g. "Chapter 1". */
  eyebrow: z.string().max(60).optional(),
  title: z.string().max(200).optional(),
  /** Body text. Separate paragraphs with blank lines; they are revealed progressively. */
  body: textSchema.optional(),
  image: mediaSchema.optional(),
  /** Video shown in the card's media area instead of the image. */
  video: videoSchema.optional(),
  /**
   * Where the image or video sits: above the text (default), below it, or beside it.
   * "left" and "right" widen the card and stack on small screens. Ignored by the "cover" layout.
   */
  mediaPosition: z.enum(["top", "bottom", "left", "right"]).optional(),
  /** "cover" crops the image to fill its area (default); "contain" shows all of it. */
  imageFit: z.enum(["cover", "contain"]).optional(),
  /** Text alignment of the card. Left when omitted. */
  align: z.enum(["left", "center", "right"]).optional(),
  /** Visual treatment of the card. */
  layout: z.enum(["default", "cover", "quote", "stat"]).default("default"),
  /** Big number/figure for the "stat" layout. */
  stat: z.object({ value: z.string().max(24), label: z.string().max(80) }).optional(),
  /** Optional "Learn more" section the learner can expand. */
  expandable: z
    .object({ label: z.string().max(80).default("Learn more"), body: textSchema })
    .optional(),
  /** Optional link button, e.g. to a document or a longer read. */
  action: z
    .object({
      /** Button text. */
      label: z.string().min(1).max(80),
      /** Where the button leads. External links open in a new tab. */
      href: linkHrefSchema,
    })
    .optional(),
  /** Optional quick knowledge check embedded in the card. */
  check: storyCardCheckSchema.optional(),
});
export type StoryCard = z.infer<typeof storyCardSchema>;

export const storyCardsSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("story-cards"),
  content: z.object({
    cards: z.array(storyCardSchema).min(1).max(60),
  }),
  behavior: z
    .object({
      /** Reveal paragraphs one after another with a short stagger. */
      progressiveReveal: z.boolean().default(true),
      allowBack: z.boolean().default(true),
      showProgress: z.boolean().default(true),
      /** Learner must answer embedded checks before moving on. */
      requireChecks: z.boolean().default(true),
    })
    .default({ progressiveReveal: true, allowBack: true, showProgress: true, requireChecks: true }),
});
export type StoryCardsConfig = z.infer<typeof storyCardsSchema>;
export type StoryCardsInput = z.input<typeof storyCardsSchema>;
