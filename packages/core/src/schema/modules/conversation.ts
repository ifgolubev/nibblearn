import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

export const conversationMessageSchema = z.object({
  /** "them": the other person. "system": a neutral status line (e.g. "2 hours later"). */
  from: z.enum(["them", "system"]).default("them"),
  text: textSchema,
  /** Typing delay before this message appears (ms). Defaults scale with text length. */
  delayMs: z.number().int().min(0).max(10000).optional(),
});

export const conversationResponseSchema = z.object({
  id: idSchema.optional(),
  text: textSchema,
  /** Id of the next node. */
  next: idSchema,
  /** Tone label shown in the summary, e.g. "Empathetic", "Defensive". */
  tone: z.string().max(40).optional(),
  /** Effectiveness 0–1 used for scoring and feedback. */
  effectiveness: z.number().min(0).max(1).default(0.5),
  /** Coaching feedback shown after choosing. */
  feedback: textSchema.optional(),
});

export const conversationNodeSchema = z.object({
  id: idSchema,
  /** Messages shown when entering this node. */
  messages: z.array(conversationMessageSchema).default([]),
  /** Response options. Omit (or leave empty) to make this an ending. */
  responses: z.array(conversationResponseSchema).max(5).default([]),
  /** Ending summary (used when there are no responses). */
  summary: textSchema.optional(),
  outcome: z.enum(["success", "neutral", "failure"]).optional(),
});
export type ConversationNode = z.infer<typeof conversationNodeSchema>;

export const conversationSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("conversation"),
    content: z.object({
      contact: z.object({
        name: z.string().max(80),
        role: z.string().max(80).optional(),
        avatar: mediaSchema.optional(),
        /** Status line under the name, e.g. "Online". */
        status: z.string().max(40).optional(),
      }),
      start: idSchema,
      nodes: z.array(conversationNodeSchema).min(1).max(200),
    }),
    behavior: z
      .object({
        /** Animate "typing…" before incoming messages. */
        typingIndicator: z.boolean().default(true),
        /** Show tone/effectiveness feedback after each reply. */
        showFeedback: z.boolean().default(true),
        allowRetry: z.boolean().default(true),
        maxSteps: z.number().int().min(1).max(500).default(60),
      })
      .default({ typingIndicator: true, showFeedback: true, allowRetry: true, maxSteps: 60 }),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set(cfg.content.nodes.map((n) => n.id));
    if (!ids.has(cfg.content.start)) {
      ctx.addIssue({
        code: "custom",
        path: ["content", "start"],
        message: `start node "${cfg.content.start}" does not exist`,
      });
    }
    cfg.content.nodes.forEach((n, i) =>
      n.responses.forEach((r, j) => {
        if (!ids.has(r.next)) {
          ctx.addIssue({
            code: "custom",
            path: ["content", "nodes", i, "responses", j, "next"],
            message: `response "${r.text.slice(0, 40)}" points to unknown node "${r.next}"`,
          });
        }
      }),
    );
  });
export type ConversationConfig = z.infer<typeof conversationSchema>;
export type ConversationInput = z.input<typeof conversationSchema>;
