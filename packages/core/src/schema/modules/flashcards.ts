import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

export const flashcardSchema = z.object({
  id: idSchema.optional(),
  front: textSchema,
  back: textSchema,
  frontImage: mediaSchema.optional(),
  backImage: mediaSchema.optional(),
  /** Optional hint shown on demand on the front side. */
  hint: textSchema.optional(),
  /** Small label, e.g. "Metric". */
  tag: z.string().max(40).optional(),
});
export type Flashcard = z.infer<typeof flashcardSchema>;

export const flashcardsSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("flashcards"),
  content: z.object({
    cards: z.array(flashcardSchema).min(1).max(200),
  }),
  behavior: z
    .object({
      /** Shuffle the deck when the module starts. */
      shuffle: z.boolean().default(false),
      /** Show a shuffle button. */
      allowShuffle: z.boolean().default(true),
      /** Keep looping over "practice again" cards until every card is marked "got it". */
      requireMastery: z.boolean().default(true),
      /** Flip the card automatically when it is shown (useful for pure reading mode). */
      autoFlip: z.boolean().default(false),
    })
    .default({ shuffle: false, allowShuffle: true, requireMastery: true, autoFlip: false }),
});
export type FlashcardsConfig = z.infer<typeof flashcardsSchema>;
export type FlashcardsInput = z.input<typeof flashcardsSchema>;
