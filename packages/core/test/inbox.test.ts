import { describe, expect, it } from "vitest";
import {
  evaluateTriage,
  gradeTriageDecision,
  inboxTriageSchema,
  isPriorityMessage,
  nextUnhandledIndex,
  validateLesson,
  validateModule,
  type InboxTriageInput,
} from "../src";

const input = {
  id: "inbox",
  type: "inbox-triage",
  content: {
    owner: { name: "Jordan Reyes", role: "Account Manager" },
    actions: [
      { id: "reply", label: "Reply now", icon: "reply", tone: "accent" },
      { id: "delegate", label: "Delegate", icon: "forward", tone: "sky" },
      { id: "archive", label: "Archive", icon: "archive" },
      { id: "report", label: "Report", icon: "alert", tone: "pink" },
    ],
    messages: [
      {
        id: "vip",
        from: { name: "Priya Nair" },
        subject: "Conversions at zero",
        preview: "Since midnight…",
        body: "Help.",
        time: "08:57",
        flags: ["vip", "external"],
        correctAction: "reply",
        explanation: "VIP with a deadline.",
      },
      {
        id: "po",
        from: { name: "Finance" },
        subject: "PO number",
        preview: "Missing PO…",
        body: "Please send the PO.",
        time: "08:15",
        correctAction: "delegate",
        acceptable: ["reply"],
        explanation: "The coordinator owns it.",
      },
      {
        id: "news",
        from: { name: "Pulse" },
        subject: "What's new",
        preview: "Updates…",
        body: "Release notes.",
        time: "07:30",
        correctAction: "archive",
        explanation: "No action needed.",
      },
      {
        id: "phish",
        from: { name: "Ads Support", email: "security@adwave-busines.com" },
        subject: "Verify your password",
        preview: "Your account will be suspended…",
        body: "Click here.",
        time: "06:12",
        flags: ["suspicious-link"],
        correctAction: "report",
        explanation: "Lookalike domain.",
      },
    ],
  },
} satisfies InboxTriageInput;

const config = inboxTriageSchema.parse(input);

describe("inbox-triage schema", () => {
  it("applies defaults", () => {
    expect(config.behavior).toEqual({ feedback: "instant", allowRetry: true, showScore: true });
    expect(config.content.messages[2]!.flags).toEqual([]);
    expect(config.content.messages[2]!.acceptable).toEqual([]);
  });

  it("validates inside a lesson", () => {
    const res = validateLesson({ schemaVersion: 1, id: "l", title: "L", modules: [input] });
    expect(res.success).toBe(true);
  });

  it("rejects duplicate ids and unknown or repeated action references", () => {
    const res = validateModule({
      ...input,
      content: {
        ...input.content,
        actions: [...input.content.actions, { id: "reply", label: "Again" }],
        messages: [
          ...input.content.messages.slice(0, 3),
          { ...input.content.messages[3], id: "vip", correctAction: "escalate" },
          { ...input.content.messages[1], id: "po2", acceptable: ["delegate", "ghost"] },
        ],
      },
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const messages = res.issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/duplicate action id "reply"/);
    expect(messages).toMatch(/duplicate message id "vip"/);
    expect(messages).toMatch(/refers to unknown action "escalate"/);
    expect(messages).toMatch(/unknown acceptable action "ghost"/);
    expect(messages).toMatch(/must not repeat correctAction "delegate"/);
    const paths = res.issues.map((i) => i.path);
    expect(paths).toContain("content.messages[3].correctAction");
    expect(paths).toContain("content.messages[4].acceptable[1]");
  });

  it("enforces 2–5 actions and 3–12 messages", () => {
    const tooFewActions = inboxTriageSchema.safeParse({
      ...input,
      content: { ...input.content, actions: input.content.actions.slice(0, 1) },
    });
    expect(tooFewActions.success).toBe(false);
    const tooFewMessages = inboxTriageSchema.safeParse({
      ...input,
      content: { ...input.content, messages: input.content.messages.slice(0, 2) },
    });
    expect(tooFewMessages.success).toBe(false);
    const badFlag = inboxTriageSchema.safeParse({
      ...input,
      content: {
        ...input.content,
        messages: [{ ...input.content.messages[0], flags: ["urgent"] }, ...input.content.messages],
      },
    });
    expect(badFlag.success).toBe(false);
  });
});

describe("inbox-triage logic", () => {
  it("grades decisions as correct, acceptable, wrong or pending", () => {
    const po = config.content.messages[1]!;
    expect(gradeTriageDecision(po, "delegate")).toEqual({ status: "correct", points: 1 });
    expect(gradeTriageDecision(po, "reply")).toEqual({ status: "acceptable", points: 0.5 });
    expect(gradeTriageDecision(po, "archive")).toEqual({ status: "wrong", points: 0 });
    expect(gradeTriageDecision(po, undefined)).toEqual({ status: "pending", points: 0 });
  });

  it("flags VIP, suspicious and urgent-action messages as priority", () => {
    const [vip, po, news, phish] = config.content.messages;
    const { actions } = config.content;
    expect(isPriorityMessage(vip!, actions)).toBe(true);
    expect(isPriorityMessage(po!, actions)).toBe(false);
    expect(isPriorityMessage(news!, actions)).toBe(false);
    expect(isPriorityMessage(phish!, actions)).toBe(true);
    // An expert "reply" call is a priority even without a VIP flag.
    expect(isPriorityMessage({ id: "x", correctAction: "reply" }, actions)).toBe(true);
  });

  it("evaluates a full run: score, counts per action and missed priorities", () => {
    const ev = evaluateTriage(config, {
      vip: "delegate",
      po: "reply",
      news: "archive",
      phish: "report",
    });
    expect(ev.messages.map((m) => m.status)).toEqual(["wrong", "acceptable", "correct", "correct"]);
    expect(ev.messages.map((m) => m.points)).toEqual([0, 0.5, 1, 1]);
    expect(ev.points).toBe(2.5);
    expect(ev.total).toBe(4);
    expect(ev.score).toBe(0.625);
    expect(ev.handled).toBe(4);
    expect(ev).toMatchObject({ correct: 2, acceptable: 1, wrong: 1, pending: 0 });
    expect(ev.actionCounts).toEqual({ reply: 1, delegate: 1, archive: 1, report: 1 });
    expect(ev.expertCounts).toEqual({ reply: 1, delegate: 1, archive: 1, report: 1 });
    expect(ev.missedPriority).toEqual(["vip"]);
    expect(ev.messages[0]).toEqual({
      id: "vip",
      decision: "delegate",
      correctAction: "reply",
      status: "wrong",
      points: 0,
      priority: true,
    });
  });

  it("treats missing decisions as pending and unknown actions as wrong", () => {
    const ev = evaluateTriage(config, { vip: "reply", phish: "nonsense" });
    expect(ev.messages.map((m) => m.status)).toEqual(["correct", "pending", "pending", "wrong"]);
    expect(ev.handled).toBe(2);
    expect(ev.pending).toBe(2);
    expect(ev.score).toBe(0.25);
    expect(ev.actionCounts).toEqual({ reply: 1, delegate: 0, archive: 0, report: 0 });
    expect(ev.missedPriority).toEqual(["phish"]);
    expect(ev.messages[1]).not.toHaveProperty("decision");
  });

  it("scores a perfect run as 1 with nothing missed", () => {
    const ev = evaluateTriage(
      config,
      Object.fromEntries(config.content.messages.map((m) => [m.id, m.correctAction])),
    );
    expect(ev.score).toBe(1);
    expect(ev.missedPriority).toEqual([]);
  });

  it("finds the next unhandled message, wrapping around", () => {
    const msgs = config.content.messages;
    expect(nextUnhandledIndex(msgs, {}, 0)).toBe(1);
    expect(nextUnhandledIndex(msgs, { po: "reply" }, 0)).toBe(2);
    expect(nextUnhandledIndex(msgs, { news: "archive", phish: "report" }, 1)).toBe(0);
    expect(nextUnhandledIndex(msgs, { vip: "reply" }, -1)).toBe(1);
    expect(nextUnhandledIndex(msgs, { vip: "a", po: "b", news: "c", phish: "d" }, 2)).toBe(-1);
  });
});
