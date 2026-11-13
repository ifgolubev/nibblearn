import { z } from "zod";
import { idSchema, moduleBaseShape, retryBehaviorShape, textSchema } from "../common";

export const blankSchema = z.object({
  /** Referenced from the template as {{id}}. */
  id: idSchema,
  /** Accepted answers. The first one is shown in the word bank and solution. */
  answers: z.array(z.string().min(1).max(120)).min(1),
  hint: textSchema.optional(),
  explanation: textSchema.optional(),
});
export type Blank = z.infer<typeof blankSchema>;

export const fillBlanksSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("fill-blanks"),
    content: z.object({
      /** Text with blanks written as {{blankId}}. */
      template: z.string().min(1).max(4000),
      blanks: z.array(blankSchema).min(1).max(20),
      /** Extra wrong words shown in the word bank. */
      distractors: z.array(z.string().min(1).max(120)).default([]),
      explanation: textSchema.optional(),
    }),
    behavior: z
      .object({
        ...retryBehaviorShape,
        /** "word-bank": tap words to fill blanks. "typed": free text input. */
        mode: z.enum(["word-bank", "typed"]).default("word-bank"),
        caseSensitive: z.boolean().default(false),
        /** Ignore surrounding whitespace and punctuation when comparing typed answers. */
        lenient: z.boolean().default(true),
        shuffleBank: z.boolean().default(true),
      })
      .default({
        allowRetry: true,
        maxAttempts: 0,
        showExplanation: true,
        mode: "word-bank",
        caseSensitive: false,
        lenient: true,
        shuffleBank: true,
      }),
  })
  .superRefine((cfg, ctx) => {
    const inTemplate = new Set(
      [...cfg.content.template.matchAll(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g)].map((m) => m[1]!),
    );
    const declared = new Set(cfg.content.blanks.map((b) => b.id));
    for (const id of inTemplate) {
      if (!declared.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "template"],
          message: `template uses {{${id}}} but no blank with id "${id}" is defined`,
        });
      }
    }
    cfg.content.blanks.forEach((b, i) => {
      if (!inTemplate.has(b.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "blanks", i, "id"],
          message: `blank "${b.id}" is not used in the template (write {{${b.id}}})`,
        });
      }
    });
  });
export type FillBlanksConfig = z.infer<typeof fillBlanksSchema>;
export type FillBlanksInput = z.input<typeof fillBlanksSchema>;
