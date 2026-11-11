import { z } from "zod";
import { idSchema, moduleBaseShape, textSchema } from "../common";

/** Icons available for triage actions. */
export const inboxActionIconSchema = z.enum([
  "reply",
  "forward",
  "calendar",
  "archive",
  "flag",
  "alert",
]);
export type InboxActionIcon = z.infer<typeof inboxActionIconSchema>;

/** Brand tones for triage actions. Omit for a neutral action. */
export const inboxActionToneSchema = z.enum(["accent", "lime", "pink", "sky", "violet"]);
export type InboxActionTone = z.infer<typeof inboxActionToneSchema>;

/** Message markers shown in the list and the reading pane. */
export const inboxFlagSchema = z.enum(["vip", "external", "attachment", "suspicious-link"]);
export type InboxFlag = z.infer<typeof inboxFlagSchema>;

export const inboxActionSchema = z.object({
  id: idSchema,
  /** Button label, e.g. "Reply now". */
  label: z.string().min(1).max(40),
  /** One line explaining when to use it (shown as a tooltip and to screen readers). */
  description: z.string().max(160).optional(),
  icon: inboxActionIconSchema.optional(),
  tone: inboxActionToneSchema.optional(),
});
export type InboxAction = z.infer<typeof inboxActionSchema>;

export const inboxPersonSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.string().max(80).optional(),
  email: z.string().max(120).optional(),
});
export type InboxPerson = z.infer<typeof inboxPersonSchema>;

export const inboxMessageSchema = z.object({
  id: idSchema,
  from: inboxPersonSchema,
  subject: z.string().min(1).max(200),
  /** One-line teaser shown in the message list. */
  preview: z.string().min(1).max(280),
  /** Full message. Blank lines separate paragraphs. */
  body: textSchema,
  /** Time label shown as-is, e.g. "08:57" or "Fri". */
  time: z.string().min(1).max(24),
  flags: z.array(inboxFlagSchema).max(4).default([]),
  /** Id of the expert's action. */
  correctAction: idSchema,
  /** Other action ids that earn partial credit. */
  acceptable: z.array(idSchema).max(4).default([]),
  /** Why the expert action is right. Shown as coaching and in the summary. */
  explanation: textSchema,
});
export type InboxMessage = z.infer<typeof inboxMessageSchema>;

export const inboxTriageSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("inbox-triage"),
    content: z.object({
      /** Whose inbox this is. */
      owner: z.object({
        name: z.string().min(1).max(80),
        role: z.string().max(80).optional(),
      }),
      actions: z.array(inboxActionSchema).min(2).max(5),
      messages: z.array(inboxMessageSchema).min(3).max(12),
      /** Wrap-up shown on the summary screen. */
      summary: textSchema.optional(),
    }),
    behavior: z
      .object({
        /** "instant": coaching after every decision. "end": feedback only on the summary. */
        feedback: z.enum(["instant", "end"]).default("instant"),
        allowRetry: z.boolean().default(true),
        /** Show the score ring on the summary. */
        showScore: z.boolean().default(true),
      })
      .default({ feedback: "instant", allowRetry: true, showScore: true }),
  })
  .superRefine((cfg, ctx) => {
    const actionIds = new Set<string>();
    cfg.content.actions.forEach((a, i) => {
      if (actionIds.has(a.id))
        ctx.addIssue({
          code: "custom",
          path: ["content", "actions", i, "id"],
          message: `duplicate action id "${a.id}"`,
        });
      actionIds.add(a.id);
    });
    const messageIds = new Set<string>();
    cfg.content.messages.forEach((m, i) => {
      const path = ["content", "messages", i];
      if (messageIds.has(m.id))
        ctx.addIssue({
          code: "custom",
          path: [...path, "id"],
          message: `duplicate message id "${m.id}"`,
        });
      messageIds.add(m.id);
      if (!actionIds.has(m.correctAction))
        ctx.addIssue({
          code: "custom",
          path: [...path, "correctAction"],
          message: `message "${m.id}" refers to unknown action "${m.correctAction}"`,
        });
      m.acceptable.forEach((id, j) => {
        if (!actionIds.has(id))
          ctx.addIssue({
            code: "custom",
            path: [...path, "acceptable", j],
            message: `message "${m.id}" lists unknown acceptable action "${id}"`,
          });
        else if (id === m.correctAction)
          ctx.addIssue({
            code: "custom",
            path: [...path, "acceptable", j],
            message: `acceptable actions must not repeat correctAction "${id}"`,
          });
      });
    });
  });
export type InboxTriageConfig = z.infer<typeof inboxTriageSchema>;
export type InboxTriageInput = z.input<typeof inboxTriageSchema>;
