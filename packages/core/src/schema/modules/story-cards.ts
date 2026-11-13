import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

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
  /** Visual treatment of the card. */
  layout: z.enum(["default", "cover", "quote", "stat"]).default("default"),
  /** Big number/figure for the "stat" layout. */
  stat: z.object({ value: z.string().max(24), label: z.string().max(80) }).optional(),
  /** Optional "Learn more" section the learner can expand. */
  expandable: z
    .object({ label: z.string().max(80).default("Learn more"), body: textSchema })
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
