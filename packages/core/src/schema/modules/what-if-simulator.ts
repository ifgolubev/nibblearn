import { z } from "zod";
import { idSchema, moduleBaseShape, textSchema } from "../common";
import { parseFormula } from "../../logic/formula";

const formatSchema = z.enum(["number", "currency", "percent", "integer"]).default("number");

export const simulatorInputSchema = z.object({
  id: idSchema,
  label: z.string().max(80),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().default(1),
  default: z.number(),
  format: formatSchema,
  /** Short explanation shown next to the slider. */
  help: z.string().max(200).optional(),
});
export type SimulatorInput = z.infer<typeof simulatorInputSchema>;

export const simulatorOutputSchema = z.object({
  id: idSchema,
  label: z.string().max(80),
  /**
   * A safe arithmetic formula referencing input/output ids, e.g. "spend / clicks".
   * Supports + - * / % ( ), numbers, identifiers, comparisons (< <= > >= == !=),
   * and / or / not, and the functions min, max, round, abs, floor, ceil, clamp.
   * Never evaluated as JavaScript.
   */
  formula: z.string().min(1).max(400),
  format: formatSchema,
  /** Highlight this output as the headline metric. */
  primary: z.boolean().default(false),
  help: z.string().max(200).optional(),
});
export type SimulatorOutput = z.infer<typeof simulatorOutputSchema>;

export const simulatorInsightSchema = z.object({
  id: idSchema,
  /** Boolean formula, e.g. "cpa > 50 and roas < 2". */
  when: z.string().min(1).max(400),
  text: textSchema,
  tone: z.enum(["info", "success", "warning"]).default("info"),
});

export const whatIfSimulatorSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("what-if-simulator"),
    content: z.object({
      inputs: z.array(simulatorInputSchema).min(1).max(8),
      outputs: z.array(simulatorOutputSchema).min(1).max(8),
      insights: z.array(simulatorInsightSchema).max(12).default([]),
      /** Optional goal the learner must reach to complete the module. */
      challenge: z
        .object({
          description: textSchema,
          /** Boolean formula that must become true. */
          goal: z.string().min(1).max(400),
          successMessage: textSchema.optional(),
        })
        .optional(),
      /** Currency code for "currency" formatting. */
      currency: z.string().length(3).default("USD"),
    }),
    behavior: z
      .object({
        /** Show a simple bar visualisation of the outputs. */
        chart: z.enum(["bars", "none"]).default("bars"),
        /** Complete as soon as the learner changes any input (when no challenge is set). */
        completeOnInteract: z.boolean().default(true),
      })
      .default({ chart: "bars", completeOnInteract: true }),
  })
  .superRefine((cfg, ctx) => {
    const known = new Set([
      ...cfg.content.inputs.map((i) => i.id),
      ...cfg.content.outputs.map((o) => o.id),
    ]);
    const check = (formula: string, path: (string | number)[]) => {
      const res = parseFormula(formula);
      if (!res.ok) {
        ctx.addIssue({ code: "custom", path, message: `invalid formula: ${res.error}` });
        return;
      }
      for (const ref of res.refs) {
        if (!known.has(ref))
          ctx.addIssue({ code: "custom", path, message: `formula references unknown id "${ref}"` });
      }
    };
    cfg.content.outputs.forEach((o, i) => check(o.formula, ["content", "outputs", i, "formula"]));
    cfg.content.insights.forEach((o, i) => check(o.when, ["content", "insights", i, "when"]));
    if (cfg.content.challenge) check(cfg.content.challenge.goal, ["content", "challenge", "goal"]);
    cfg.content.inputs.forEach((inp, i) => {
      if (inp.min >= inp.max)
        ctx.addIssue({
          code: "custom",
          path: ["content", "inputs", i, "max"],
          message: "max must be greater than min",
        });
      if (inp.default < inp.min || inp.default > inp.max)
        ctx.addIssue({
          code: "custom",
          path: ["content", "inputs", i, "default"],
          message: "default must be within [min, max]",
        });
    });
  });
export type WhatIfSimulatorConfig = z.infer<typeof whatIfSimulatorSchema>;
export type WhatIfSimulatorInput = z.input<typeof whatIfSimulatorSchema>;
