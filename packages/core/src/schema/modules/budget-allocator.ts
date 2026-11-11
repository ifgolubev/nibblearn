import { z } from "zod";
import { idSchema, moduleBaseShape, textSchema, cssColorSchema } from "../common";

/** Floating-point tolerance used when comparing percentages. */
const EPS = 1e-6;

export const budgetChannelSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(80),
  /** One short line shown under the label. */
  description: z.string().max(200).optional(),
  /**
   * Colour token ("accent" | "info" | "success" | "warning" | "pink" | "violet" | "lime" | "sky")
   * or any CSS colour. Defaults to a palette colour by position.
   */
  color: cssColorSchema.optional(),
  /** KPI units produced per 1,000 of currency for the first 1,000 spent. */
  efficiency: z.number().positive(),
  /**
   * Diminishing-returns exponent: output = efficiency × (spend / 1000) ^ saturation.
   * 1 = linear (no saturation); lower values saturate faster.
   */
  saturation: z.number().min(0.3).max(1),
  /** Minimum share of the budget in percent (0–100). */
  min: z.number().min(0).max(100).optional(),
  /** Maximum share of the budget in percent (0–100). */
  max: z.number().min(0).max(100).optional(),
});
export type BudgetChannel = z.infer<typeof budgetChannelSchema>;

export const budgetAllocatorSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("budget-allocator"),
    content: z.object({
      /** Total budget to split, in `currency`. */
      totalBudget: z.number().positive(),
      /** ISO currency code used for formatting. */
      currency: z.string().length(3).default("USD"),
      /** What the channels produce, e.g. "Conversions" or "Leads". */
      kpiLabel: z.string().min(1).max(40),
      channels: z.array(budgetChannelSchema).min(3).max(8),
      /** Starting split: channel id → percent. Must cover every channel and sum to 100. */
      initial: z.record(z.string(), z.number().min(0).max(100)),
      /** Optional target shown live while the learner allocates. */
      goal: z
        .object({
          description: textSchema,
          /** Total KPI must reach at least this value. */
          minKpi: z.number().positive().optional(),
          /** Cost per KPI unit must be at or below this value. */
          maxCostPerKpi: z.number().positive().optional(),
        })
        .optional(),
      /** Shown after the learner locks in the plan. */
      explanation: textSchema.optional(),
    }),
    behavior: z
      .object({
        /** Slider and button increment, in percent. Must divide 100 evenly. */
        step: z.number().positive().max(50).default(5),
        /** Let the learner lock channels so rebalancing leaves them alone. */
        allowLock: z.boolean().default(true),
        /** Reveal the optimal plan after locking in. */
        showOptimal: z.boolean().default(true),
        /** Score = learner KPI ÷ optimal KPI. When false, the goal (if any) is used instead. */
        scoreAgainstOptimal: z.boolean().default(true),
      })
      .default({ step: 5, allowLock: true, showOptimal: true, scoreAgainstOptimal: true }),
  })
  .superRefine((cfg, ctx) => {
    const { channels, initial, goal } = cfg.content;
    const step = cfg.behavior.step;
    const onGrid = (v: number) => Math.abs(v / step - Math.round(v / step)) < EPS;

    if (!onGrid(100))
      ctx.addIssue({
        code: "custom",
        path: ["behavior", "step"],
        message: `step must divide 100 evenly (got ${step})`,
      });

    const ids = new Set<string>();
    channels.forEach((c, i) => {
      if (ids.has(c.id))
        ctx.addIssue({
          code: "custom",
          path: ["content", "channels", i, "id"],
          message: `duplicate channel id "${c.id}"`,
        });
      ids.add(c.id);
      if (c.min !== undefined && c.max !== undefined && c.min > c.max)
        ctx.addIssue({
          code: "custom",
          path: ["content", "channels", i, "max"],
          message: `channel "${c.id}": max must be greater than or equal to min`,
        });
    });

    for (const key of Object.keys(initial)) {
      if (!ids.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["content", "initial", key],
          message: `initial refers to unknown channel "${key}"`,
        });
    }
    let sum = 0;
    channels.forEach((c, i) => {
      const v = initial[c.id];
      if (v === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "initial"],
          message: `initial is missing a share for channel "${c.id}"`,
        });
        return;
      }
      sum += v;
      if (!onGrid(v))
        ctx.addIssue({
          code: "custom",
          path: ["content", "initial", c.id],
          message: `initial share for "${c.id}" must be a multiple of behavior.step (${step})`,
        });
      if ((c.min !== undefined && v < c.min - EPS) || (c.max !== undefined && v > c.max + EPS))
        ctx.addIssue({
          code: "custom",
          path: ["content", "channels", i],
          message: `initial share for "${c.id}" (${v}%) is outside its min/max`,
        });
    });
    if (Math.abs(sum - 100) > EPS)
      ctx.addIssue({
        code: "custom",
        path: ["content", "initial"],
        message: `initial shares must sum to 100 (got ${Number(sum.toFixed(4))})`,
      });

    const minSum = channels.reduce((s, c) => s + (c.min ?? 0), 0);
    const maxSum = channels.reduce((s, c) => s + (c.max ?? 100), 0);
    if (minSum > 100 + EPS)
      ctx.addIssue({
        code: "custom",
        path: ["content", "channels"],
        message: `channel minimums add up to more than 100% (${minSum}%)`,
      });
    if (maxSum < 100 - EPS)
      ctx.addIssue({
        code: "custom",
        path: ["content", "channels"],
        message: `channel maximums add up to less than 100% (${maxSum}%)`,
      });

    if (goal && goal.minKpi === undefined && goal.maxCostPerKpi === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["content", "goal"],
        message: "goal needs minKpi and/or maxCostPerKpi",
      });
  });
export type BudgetAllocatorConfig = z.infer<typeof budgetAllocatorSchema>;
export type BudgetAllocatorInput = z.input<typeof budgetAllocatorSchema>;
