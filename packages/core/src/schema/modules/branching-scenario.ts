import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

export const scenarioChoiceSchema = z.object({
  id: idSchema.optional(),
  text: textSchema,
  /** Id of the node to go to. */
  next: idSchema,
  /** Feedback shown right after choosing, before moving on. */
  feedback: textSchema.optional(),
  /** Points awarded for this choice (may be negative). */
  points: z.number().default(0),
  /** Qualitative rating used for colouring the decision history. */
  quality: z.enum(["good", "neutral", "poor"]).default("neutral"),
});
export type ScenarioChoice = z.infer<typeof scenarioChoiceSchema>;

export const scenarioNodeSchema = z.object({
  id: idSchema,
  /** "decision" nodes offer choices; "ending" nodes finish the scenario. */
  kind: z.enum(["decision", "ending"]).default("decision"),
  /** Optional speaker/role label, e.g. "Client". */
  speaker: z.string().max(60).optional(),
  title: z.string().max(140).optional(),
  text: textSchema,
  image: mediaSchema.optional(),
  choices: z.array(scenarioChoiceSchema).max(6).default([]),
  /** For endings: how the scenario turned out. */
  outcome: z.enum(["success", "neutral", "failure"]).optional(),
  /** For endings: a lesson summary. */
  summary: textSchema.optional(),
});
export type ScenarioNode = z.infer<typeof scenarioNodeSchema>;

export const branchingScenarioSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("branching-scenario"),
    content: z.object({
      /** Id of the first node. */
      start: idSchema,
      nodes: z.array(scenarioNodeSchema).min(2).max(200),
      /** Optional short setup shown before the first decision. */
      intro: textSchema.optional(),
    }),
    behavior: z
      .object({
        showScore: z.boolean().default(true),
        allowRetry: z.boolean().default(true),
        showHistory: z.boolean().default(true),
        /** Maximum points reachable; used to normalise the score. Computed when omitted. */
        maxPoints: z.number().optional(),
        /** Safety limit for loops in the graph. */
        maxSteps: z.number().int().min(2).max(500).default(60),
      })
      .default({ showScore: true, allowRetry: true, showHistory: true, maxSteps: 60 }),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Map<string, number>();
    cfg.content.nodes.forEach((n, i) => {
      if (ids.has(n.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "nodes", i, "id"],
          message: `duplicate node id "${n.id}"`,
        });
      }
      ids.set(n.id, i);
    });
    if (!ids.has(cfg.content.start)) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "start"],
        message: `start node "${cfg.content.start}" does not exist`,
      });
    }
    cfg.content.nodes.forEach((n, i) => {
      if (n.kind === "decision" && n.choices.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["content", "nodes", i, "choices"],
          message: `decision node "${n.id}" needs at least one choice (or set kind: "ending")`,
        });
      }
      n.choices.forEach((c, j) => {
        if (!ids.has(c.next)) {
          ctx.addIssue({
            code: "custom",
            path: ["content", "nodes", i, "choices", j, "next"],
            message: `choice "${c.text.slice(0, 40)}" points to unknown node "${c.next}"`,
          });
        }
      });
    });
    const hasEnding = cfg.content.nodes.some((n) => n.kind === "ending");
    if (!hasEnding) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "nodes"],
        message: 'the scenario needs at least one node with kind: "ending"',
      });
    }
  });
export type BranchingScenarioConfig = z.infer<typeof branchingScenarioSchema>;
export type BranchingScenarioInput = z.input<typeof branchingScenarioSchema>;
