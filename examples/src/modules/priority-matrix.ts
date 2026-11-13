import type { PriorityMatrixInput } from "@nibblearn/core";

export const priorityMatrixDemo = {
  id: "monday-morning-triage",
  type: "priority-matrix",
  title: "Monday morning at Brightline Media",
  instructions:
    "It's 9:05 and you're the account manager on Northwind Outdoor and Harbor Supply Co. Place each task on the matrix: drag it into a quadrant, or tap the task and then the quadrant.",
  content: {
    axes: {
      x: { label: "Urgency", low: "low", high: "high" },
      y: { label: "Importance", low: "low", high: "high" },
    },
    quadrants: [
      {
        id: "schedule",
        position: "top-left",
        label: "Schedule",
        description: "Important, not urgent — block time for it",
        color: "accent",
      },
      {
        id: "do-now",
        position: "top-right",
        label: "Do now",
        description: "Urgent and important — handle it yourself, today",
        color: "pink",
      },
      {
        id: "drop",
        position: "bottom-left",
        label: "Drop",
        description: "Neither — let it go",
        color: "violet",
      },
      {
        id: "delegate",
        position: "bottom-right",
        label: "Delegate",
        description: "Urgent, not important — hand it on",
        color: "sky",
      },
    ],
    items: [
      {
        id: "tracking",
        text: "Tracking is broken on Northwind's live campaign",
        quadrantId: "do-now",
        explanation:
          "Every hour without tracking is spend you can't measure or optimise, and the campaign is live. Get Analytics on it before anything else.",
      },
      {
        id: "q3-deck",
        text: "Draft the Q3 strategy deck for Harbor Supply",
        quadrantId: "schedule",
        explanation:
          "It shapes next quarter's budget, but the review is three weeks away. Block focused time this week so it never becomes an emergency.",
      },
      {
        id: "reformat",
        text: "Reformat last week's slides for an internal sync",
        quadrantId: "delegate",
        explanation:
          "Someone needs it today, but it doesn't need an account manager. A coordinator can turn it around while you deal with the client work.",
      },
      {
        id: "survey",
        text: "Reply to a vendor's newsletter survey",
        quadrantId: "drop",
        explanation:
          "No deadline that matters and no effect on any client. Archive it and move on.",
      },
      {
        id: "creative",
        text: "Approve creative due to launch at 2pm today",
        quadrantId: "do-now",
        explanation:
          "A missed approval delays the launch and the media plan behind it. It's time-bound and client-facing, so it's yours this morning.",
      },
      {
        id: "training",
        text: "Book training on the new attribution tool",
        quadrantId: "schedule",
        explanation:
          "Better attribution will change how you report to every client, but nothing breaks if you book it on Wednesday instead of now.",
      },
      {
        id: "export",
        text: "Pull a routine weekly export",
        quadrantId: "delegate",
        explanation:
          "Due today, but it follows a fixed recipe. Hand it to the analyst who owns the dashboard — or ask them to automate it.",
      },
      {
        id: "archive",
        text: "Tidy the shared drive's archive folder",
        quadrantId: "drop",
        explanation:
          "Satisfying, but neither urgent nor important on a Monday morning. Leave it for a quiet Friday, or for never.",
      },
    ],
    explanation:
      "Urgency is about the clock; importance is about the client and the business. Do the urgent-and-important work yourself, protect time for the important work before it turns urgent, hand routine urgent tasks to the right person, and give yourself permission to drop the rest.",
  },
  behavior: { allowRetry: true, maxAttempts: 3, showExplanation: true, shuffle: true },
  feedback: {
    correct:
      "That's how a calm Monday starts: two fires out, two blocks booked, two tasks handed on.",
    complete:
      "Run this triage every Monday before you open Slack. It takes two minutes and saves the week.",
  },
} satisfies PriorityMatrixInput;
