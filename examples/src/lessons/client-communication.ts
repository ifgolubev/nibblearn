import type { LessonInput } from "@nibblearn/core";
import { branchingScenarioDemo } from "../modules/branching-scenario";
import { conversationDemo } from "../modules/conversation";
import { inboxTriageDemo } from "../modules/inbox-triage";

/** Example C — Client Communication. */
export const clientCommunicationLesson = {
  schemaVersion: 1,
  id: "client-communication",
  title: "Client Communication",
  description:
    "Scenario-based practice for the conversations that decide whether a client stays: unclear briefs, urgent messages, managing expectations and knowing when to escalate.",
  objectives: [
    "Respond to requests with clarity and a next step",
    "Turn an unclear brief into a usable one without friction",
    "Manage expectations when performance dips",
    "Recognise when to escalate — and to whom",
  ],
  intro: { show: true, estimatedMinutes: 10 },
  gamification: { points: true, celebration: true },
  modules: [
    {
      id: "principles",
      type: "story-cards",
      title: "Four principles",
      content: {
        cards: [
          {
            layout: "cover",
            title: "Clients do not buy campaigns. They buy confidence.",
            body: "Every message you send either adds to that confidence or takes from it.",
          },
          {
            eyebrow: "1 · Acknowledge fast",
            title: "Reply within the hour, even without the answer",
            body: "“Got it, looking into this now, I will update you by 3pm” is a complete reply. Silence is not.",
          },
          {
            eyebrow: "2 · Lead with the decision",
            title: "Headline first, reasons second",
            body: "Say what you recommend, then why. Clients skim; make the first sentence the one that matters.",
          },
          {
            eyebrow: "3 · Own it",
            title: "Never blame the platform, the data or the intern",
            body: "Clients forgive mistakes. They do not forgive excuses.",
            expandable: {
              label: "An example",
              body: "“The conversion tracking was misconfigured on our side; we fixed it this morning and here is the corrected number.” That sentence costs nothing and buys trust.",
            },
          },
          {
            eyebrow: "4 · Escalate early",
            title: "A problem you share is half the size",
            body: "If you cannot fix it today, your account director needs to know today. Escalation is not failure; late escalation is.",
            check: {
              question: "When should you escalate a problem you cannot fix yourself?",
              options: [
                { text: "The same day", correct: true },
                { text: "After trying for a week" },
                { text: "Only if the client complains" },
              ],
            },
          },
        ],
      },
    },
    {
      id: "unclear-brief",
      type: "choice-challenge",
      title: "The unclear brief",
      instructions:
        "A client sends: “We want to do something on TikTok, maybe next month, budget TBD. Thoughts?”",
      content: {
        questions: [
          {
            prompt: "What is the best reply?",
            options: [
              {
                text: "“Great idea! We will put a plan together.”",
                explanation: "Enthusiastic, but you still know nothing. The plan will be a guess.",
              },
              {
                text: "“Happy to. To scope it, could you share the goal, the audience and a rough budget range? A 20-minute call this week would cover it.”",
                correct: true,
                explanation: "Positive, specific, and it proposes the next step.",
              },
              {
                text: "“We need a proper brief before we can look at this.”",
                explanation: "Correct in substance, cold in tone.",
              },
            ],
          },
          {
            prompt:
              "The client replies: “Budget is whatever gets results.” Select every good next move.",
            options: [
              { text: "Offer two or three budget scenarios with expected outcomes", correct: true },
              { text: "Ask what result would make the pilot a success", correct: true },
              {
                text: "Start building with a budget you think is reasonable",
                explanation: "Never spend money that was not explicitly approved.",
              },
              {
                text: "Explain that TikTok needs a minimum test budget to learn anything",
                correct: true,
              },
            ],
            explanation: "Vague budgets become concrete when you attach outcomes to numbers.",
          },
        ],
      },
    },
    { ...branchingScenarioDemo, id: "performance-dip" },
    { ...conversationDemo, id: "friday-urgent" },
    { ...inboxTriageDemo, id: "monday-triage" },
    {
      id: "escalation-calls",
      type: "true-false",
      title: "Escalate or handle?",
      instructions:
        "For each situation: **True** if you should escalate to your account director today.",
      behavior: { trueLabel: "Escalate", falseLabel: "Handle it" },
      content: {
        statements: [
          {
            text: "A client asks to move their launch by two days.",
            isTrue: false,
            explanation:
              "A schedule change inside your remit. Confirm, update the plan, inform the team.",
          },
          {
            text: "A client says they are “reconsidering the relationship” in a status call.",
            isTrue: true,
            explanation: "Any signal about the relationship itself goes up the same day.",
          },
          {
            text: "Spend is 40% over the monthly budget with ten days left.",
            isTrue: true,
            explanation: "Money problems escalate immediately, with a fix proposed.",
          },
          {
            text: "A client asks for a report format we do not have yet.",
            isTrue: false,
            explanation:
              "Agree a reasonable deadline and build it. Escalate only if it affects other accounts.",
          },
        ],
      },
    },
  ],
} satisfies LessonInput;
