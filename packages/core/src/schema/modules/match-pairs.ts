import { z } from "zod";
import { idSchema, moduleBaseShape, textSchema } from "../common";

export const pairSchema = z.object({
  id: idSchema.optional(),
  /** Left-hand item (e.g. a term). */
  left: textSchema,
  /** Right-hand item (e.g. a definition). */
  right: textSchema,
  explanation: textSchema.optional(),
});
export type Pair = z.infer<typeof pairSchema>;

export const matchPairsSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("match-pairs"),
  content: z.object({
    pairs: z.array(pairSchema).min(2).max(30),
    leftLabel: z.string().max(40).optional(),
    rightLabel: z.string().max(40).optional(),
  }),
  behavior: z
    .object({
      shuffle: z.boolean().default(true),
      /** Show an elapsed-time counter. */
      timer: z.boolean().default(false),
      /** Maximum pairs visible at once; remaining pairs appear as matches are made. */
      pairsPerRound: z.number().int().min(2).max(12).default(6),
      /** Enable drag-and-drop in addition to tap-to-connect. */
      drag: z.boolean().default(true),
    })
    .default({ shuffle: true, timer: false, pairsPerRound: 6, drag: true }),
});
export type MatchPairsConfig = z.infer<typeof matchPairsSchema>;
export type MatchPairsInput = z.input<typeof matchPairsSchema>;
