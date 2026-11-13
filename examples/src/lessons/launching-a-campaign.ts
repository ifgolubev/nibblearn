import type { LessonInput } from "@nibblearn/core";
import { sequenceBuilderDemo } from "../modules/sequence-builder";
import { categorySortDemo } from "../modules/category-sort";
import { hotspotExplorerDemo } from "../modules/hotspot-explorer";
import { spotTheMistakeDemo } from "../modules/spot-the-mistake";

/** Example B — Launching a Marketing Campaign. */
export const launchingACampaignLesson = {
  schemaVersion: 1,
  id: "launching-a-campaign",
  title: "Launching a Marketing Campaign",
  description:
    "From a client brief to a live campaign: plan the work in the right order, know who owns each piece, read the dashboard you will be reporting from, and catch setup mistakes before the client does.",
  objectives: [
    "Order the stages of a paid media launch",
    "Assign activities to the right team",
    "Find the key sections of the analytics dashboard",
    "Spot configuration mistakes in a campaign setup",
  ],
  intro: { show: true, estimatedMinutes: 12 },
  gamification: { points: true, celebration: true },
  completion: { rule: "score", threshold: 0.6 },
  modules: [
    {
      id: "brief-to-launch",
      type: "story-cards",
      title: "It starts with a brief",
      content: {
        cards: [
          {
            layout: "cover",
            eyebrow: "Chapter 1",
            title: "Every campaign starts with a brief",
            body: "A brief answers four questions: **who** we are talking to, **what** we want them to do, **how much** we can spend, and **how** we will know it worked.",
          },
          {
            eyebrow: "The rule",
            title: "No brief, no build",
            body: "Media Buying never builds from a Slack message. If a client wants to “just quickly launch something”, Account Management turns the request into a one-page brief first.\n\nIt takes twenty minutes and saves a week.",
          },
          {
            layout: "stat",
            stat: { value: "48h", label: "from approved brief to launch-ready setup" },
            body: "That is the standard for a search or social campaign with existing creative. Anything faster needs a reason; anything slower needs a plan.",
          },
          {
            eyebrow: "Checkpoint",
            title: "Creative approval",
            body: "Creative goes to the client **before** tracking setup, not after. A rejected ad on launch day is the most expensive kind of rejection.",
            check: {
              question: "When does the client approve creative?",
              options: [
                { text: "Before tracking setup", correct: true },
                { text: "On launch day" },
                { text: "After the first report" },
              ],
              explanation: "Approval happens before setup so launch day has no surprises.",
            },
          },
        ],
      },
    },
    { ...sequenceBuilderDemo, id: "launch-order" },
    { ...categorySortDemo, id: "launch-ownership" },
    { ...hotspotExplorerDemo, id: "dashboard-tour" },
    { ...spotTheMistakeDemo, id: "setup-qa" },
    {
      id: "launch-checklist",
      type: "true-false",
      title: "Launch checklist",
      instructions: "Last check before you press go.",
      content: {
        statements: [
          {
            text: "UTM parameters should be tested on a real click before launch.",
            isTrue: true,
            explanation: "A broken UTM means a week of unattributed traffic.",
          },
          {
            text: "If the client approved the creative, you can skip the landing page check.",
            isTrue: false,
            explanation: "Creative approval covers the ads, not the page they land on.",
          },
          {
            text: "Budgets are entered as daily amounts in most platforms, so a monthly budget must be divided first.",
            isTrue: true,
            explanation: "Entering a monthly figure as a daily budget is the classic overspend.",
          },
          {
            text: "The first optimisation review happens one week after launch.",
            isTrue: false,
            explanation:
              "The first review is at 48 hours: enough data to catch obvious problems, early enough to fix them.",
          },
        ],
      },
    },
  ],
} satisfies LessonInput;
