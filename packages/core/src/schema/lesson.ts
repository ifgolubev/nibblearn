import { z } from "zod";
import { cssColorSchema, fontFamilySchema, idSchema, mediaSchema, textSchema } from "./common";
import {
  branchingScenarioSchema,
  budgetAllocatorSchema,
  categorySortSchema,
  choiceChallengeSchema,
  conversationSchema,
  estimateSchema,
  fillBlanksSchema,
  flashcardsSchema,
  hotspotExplorerSchema,
  imageCompareSchema,
  inboxTriageSchema,
  labelDiagramSchema,
  matchPairsSchema,
  priorityMatrixSchema,
  processExplorerSchema,
  screenshotWalkthroughSchema,
  sequenceBuilderSchema,
  spotTheMistakeSchema,
  storyCardsSchema,
  trueFalseSchema,
  whatIfSimulatorSchema,
  wordBuilderSchema,
} from "./modules";

/** Union of all built-in module configs (output / parsed form). */
export const builtInModuleSchema = z.discriminatedUnion("type", [
  storyCardsSchema,
  flashcardsSchema,
  choiceChallengeSchema,
  trueFalseSchema,
  matchPairsSchema,
  sequenceBuilderSchema,
  categorySortSchema,
  fillBlanksSchema,
  hotspotExplorerSchema,
  screenshotWalkthroughSchema,
  branchingScenarioSchema,
  conversationSchema,
  processExplorerSchema,
  spotTheMistakeSchema,
  whatIfSimulatorSchema,
  budgetAllocatorSchema,
  estimateSchema,
  inboxTriageSchema,
  labelDiagramSchema,
  imageCompareSchema,
  wordBuilderSchema,
  priorityMatrixSchema,
]);
export type BuiltInModuleConfig = z.infer<typeof builtInModuleSchema>;
export type BuiltInModuleInput = z.input<typeof builtInModuleSchema>;

/** Any module config: a built-in one or a custom (registered) one. */
export type ModuleConfig = BuiltInModuleConfig | CustomModuleConfig;
export interface CustomModuleConfig {
  id: string;
  type: string;
  title?: string;
  instructions?: string;
  [key: string]: unknown;
}

export const themeConfigSchema = z
  .object({
    /** "system" follows the OS preference. */
    mode: z.enum(["light", "dark", "system"]).default("system"),
    /** Accent color (a plain CSS color: name, #hex, rgb(), hsl(), oklch()…). */
    accent: cssColorSchema.optional(),
    /** Base corner radius in px. */
    radius: z.number().min(0).max(32).optional(),
    /** Font family stack. */
    fontFamily: fontFamilySchema.optional(),
  })
  .default({ mode: "system" });
export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export const completionRuleSchema = z
  .object({
    /** "all-modules": every module completed. "score": lesson score ≥ threshold. "any": finishing the last module. */
    rule: z.enum(["all-modules", "score", "any"]).default("all-modules"),
    /** Score threshold (0–1) for rule "score". */
    threshold: z.number().min(0).max(1).default(0.7),
  })
  .default({ rule: "all-modules", threshold: 0.7 });
export type CompletionRule = z.infer<typeof completionRuleSchema>;

export const gamificationSchema = z
  .object({
    /** Show points earned per module and in the summary. */
    points: z.boolean().default(true),
    /** Points awarded per fully correct module (scaled by score). */
    pointsPerModule: z.number().int().min(0).default(100),
    /** Show a celebration animation on lesson completion. */
    celebration: z.boolean().default(true),
    /** Show an encouraging streak counter for consecutive correct modules. */
    streaks: z.boolean().default(false),
  })
  .default({ points: true, pointsPerModule: 100, celebration: true, streaks: false });
export type GamificationConfig = z.infer<typeof gamificationSchema>;

export const lessonIntroSchema = z
  .object({
    /** Show an introduction screen before the first module. */
    show: z.boolean().default(true),
    image: mediaSchema.optional(),
    /** Estimated completion time in minutes. */
    estimatedMinutes: z.number().min(1).max(600).optional(),
    /** Label of the start button. */
    cta: z.string().max(40).optional(),
  })
  .default({ show: true });

const lessonBaseShape = {
  schemaVersion: z.literal(1),
  id: idSchema,
  title: z.string().min(1).max(200),
  description: textSchema.optional(),
  /** What the learner will be able to do after the lesson. */
  objectives: z.array(z.string().max(300)).max(12).default([]),
  /** BCP-47 language tag of the content, e.g. "en" or "en-GB". */
  language: z.string().min(2).max(12).default("en"),
  theme: themeConfigSchema,
  completion: completionRuleSchema,
  gamification: gamificationSchema,
  intro: lessonIntroSchema,
  /** Free-form metadata: author, tags, version… */
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .default({}),
};

/** The lesson schema with built-in modules only. Use `validateLesson` to support custom modules. */
export const lessonSchema = z
  .object({
    ...lessonBaseShape,
    modules: z.array(builtInModuleSchema).min(1).max(100),
  })
  .superRefine((lesson, ctx) => {
    const seen = new Set<string>();
    lesson.modules.forEach((m, i) => {
      if (seen.has(m.id))
        ctx.addIssue({
          code: "custom",
          path: ["modules", i, "id"],
          message: `duplicate module id "${m.id}"`,
        });
      seen.add(m.id);
    });
  });

/** Lesson shell used when validating with a custom registry (modules validated separately). */
export const lessonShellSchema = z.object({
  ...lessonBaseShape,
  modules: z
    .array(z.object({ id: idSchema, type: z.string().min(1) }).passthrough())
    .min(1)
    .max(100),
});

export type Lesson = Omit<z.infer<typeof lessonSchema>, "modules"> & { modules: ModuleConfig[] };
export type LessonInput = z.input<typeof lessonSchema>;
