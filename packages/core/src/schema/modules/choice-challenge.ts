import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, retryBehaviorShape, textSchema } from "../common";

export const choiceOptionSchema = z.object({
  id: idSchema.optional(),
  text: textSchema,
  image: mediaSchema.optional(),
  correct: z.boolean().default(false),
  /** Explanation shown for this specific option after checking. */
  explanation: textSchema.optional(),
});
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;

const choiceQuestionShape = z.object({
  id: idSchema.optional(),
  prompt: textSchema,
  /** Secondary context shown under the prompt. */
  context: textSchema.optional(),
  image: mediaSchema.optional(),
  /** "single": exactly one correct option. "multiple": one or more. Inferred when omitted. */
  mode: z.enum(["single", "multiple"]).optional(),
  options: z.array(choiceOptionSchema).min(2).max(8),
  /** General explanation shown after checking. */
  explanation: textSchema.optional(),
  hint: textSchema.optional(),
});

const NEEDS_CORRECT = "each question needs at least one correct option";

/** A question that is checked in the browser: at least one option must be marked correct. */
export const choiceQuestionSchema = choiceQuestionShape.refine(
  (q) => q.options.some((o) => o.correct),
  { message: NEEDS_CORRECT, path: ["options"] },
);
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;

export const choiceChallengeSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("choice-challenge"),
    content: z.object({
      questions: z.array(choiceQuestionShape).min(1).max(50),
    }),
    behavior: z
      .object({
        ...retryBehaviorShape,
        shuffleOptions: z.boolean().default(false),
        /** Award partial credit for partially correct multiple-choice answers. */
        partialCredit: z.boolean().default(true),
        /** Show the question counter ("2 of 5"). */
        showCounter: z.boolean().default(true),
        /**
         * Who checks the answers. "local" (default): the module checks each answer against the
         * options marked correct. "external": the config carries no correct answers; the module
         * collects one response per question and hands them to the host, which grades them.
         */
        evaluation: z.enum(["local", "external"]).optional(),
      })
      .default({
        allowRetry: true,
        maxAttempts: 0,
        showExplanation: true,
        shuffleOptions: false,
        partialCredit: true,
        showCounter: true,
      }),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.behavior.evaluation === "external") return;
    cfg.content.questions.forEach((q, i) => {
      if (!q.options.some((o) => o.correct))
        ctx.addIssue({
          code: "custom",
          path: ["content", "questions", i, "options"],
          message: NEEDS_CORRECT,
        });
    });
  });
export type ChoiceChallengeConfig = z.infer<typeof choiceChallengeSchema>;
export type ChoiceChallengeInput = z.input<typeof choiceChallengeSchema>;

/** One question of a graded attempt, supplied by the host to show a result (see `review`). */
export const choiceReviewItemSchema = z.object({
  /** Ids of the options the learner chose. */
  selected: z.array(z.string().max(120)).max(8).default([]),
  /** Ids of the correct options. Falls back to the options marked correct in the config. */
  correct: z.array(z.string().max(120)).max(8).optional(),
  /** The grader's verdict. Derived from `selected` and `correct` when omitted. */
  isCorrect: z.boolean().optional(),
  /** Explanation of the question. Falls back to the one in the config. */
  explanation: textSchema.optional(),
  /** Explanations per option id. Fall back to the ones in the config. */
  optionExplanations: z.record(z.string().max(120), textSchema).optional(),
});
export type ChoiceReviewItem = z.infer<typeof choiceReviewItemSchema>;

/** A graded attempt: one item per question, in the order of `content.questions`. */
export const choiceReviewSchema = z.object({
  items: z.array(choiceReviewItemSchema).max(50),
});
export type ChoiceReview = z.infer<typeof choiceReviewSchema>;
export type ChoiceReviewInput = z.input<typeof choiceReviewSchema>;
