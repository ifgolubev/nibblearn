import type { LessonInput } from "@nibblearn/core";
import { storyCardsDemo } from "../modules/story-cards";
import { processExplorerDemo } from "../modules/process-explorer";

/**
 * Example A — Welcome to the Agency.
 * An onboarding micro-course for a fictional agency, "Brightline Media".
 */
export const welcomeToTheAgencyLesson = {
  schemaVersion: 1,
  id: "welcome-to-the-agency",
  title: "Welcome to the Agency",
  description:
    "Your first hour at **Brightline Media**: how we are organised, who does what, how a project moves through the building, and where to find things when you are stuck.",
  objectives: [
    "Describe what Brightline Media does and who its clients are",
    "Name the four departments and what each one owns",
    "Explain how a campaign moves from brief to report",
    "Know where to look for information before asking",
  ],
  language: "en",
  intro: { show: true, estimatedMinutes: 8 },
  gamification: { points: true, celebration: true, streaks: true },
  completion: { rule: "all-modules" },
  metadata: { author: "Nibblearn examples", audience: "New hires", version: "1.0" },
  modules: [
    { ...storyCardsDemo, id: "welcome-story" },
    {
      id: "department-deck",
      type: "flashcards",
      title: "The four departments",
      instructions: "Flip each card. Mark it **Got it** when you could explain it to a client.",
      content: {
        cards: [
          {
            front: "Strategy",
            back: "Turns the client's business goal into a measurable plan: audience, channels, budget split and KPIs.",
            tag: "Department",
          },
          {
            front: "Media Buying",
            back: "Builds and runs the campaigns in the ad platforms. Owns bids, targeting, pacing and day-to-day optimisation.",
            tag: "Department",
          },
          {
            front: "Analytics",
            back: "Owns tracking, dashboards and reporting. If a number is on a slide, Analytics can tell you where it came from.",
            tag: "Department",
          },
          {
            front: "Account Management",
            back: "The client's single point of contact. Runs briefs, approvals, expectations and the weekly status call.",
            tag: "Department",
          },
          {
            front: "Creative Studio",
            back: "Designs ads and landing pages. Works with Strategy on messaging and with Media Buying on formats.",
            tag: "Partner team",
            hint: "Not one of the four core departments, but you will work with them every week.",
          },
          {
            front: "The Weekly",
            back: "Monday 10:00 all-hands: every account gives a 60-second update. Red / amber / green only — details go in the channel.",
            tag: "Ritual",
          },
        ],
      },
      behavior: { requireMastery: true, allowShuffle: true },
    },
    { ...processExplorerDemo, id: "campaign-lifecycle-tour" },
    {
      id: "where-to-find-things",
      type: "choice-challenge",
      title: "Where would you look?",
      instructions: "Three situations from your first week. Pick the best first move.",
      content: {
        questions: [
          {
            prompt:
              "A client asks for last month's ROAS on their search campaign. Where do you look first?",
            options: [
              {
                text: "The Pulse Analytics dashboard for the account",
                correct: true,
                explanation: "Dashboards are the source of truth for performance numbers.",
              },
              {
                text: "Ask the media buyer on Slack",
                explanation:
                  "Fine as a follow-up, but the number should already be in the dashboard.",
              },
              { text: "The campaign brief", explanation: "The brief holds targets, not results." },
            ],
            explanation: "Numbers live in dashboards. Briefs hold goals. People explain context.",
          },
          {
            prompt: "You are not sure which naming convention to use for a new campaign.",
            options: [
              {
                text: "Check the Playbook page “Campaign naming”",
                correct: true,
                explanation: "Every convention is written down in the Playbook.",
              },
              {
                text: "Invent a sensible name and fix it later",
                explanation: "Renaming campaigns breaks reporting history.",
              },
              {
                text: "Copy whatever the last campaign used",
                explanation: "The last campaign might be the exception, not the rule.",
              },
            ],
            hint: "We write things down so nobody has to guess.",
          },
          {
            prompt: "Select everything that belongs in the client's shared channel.",
            options: [
              { text: "Status updates and approvals", correct: true },
              { text: "Questions about the brief", correct: true },
              {
                text: "Internal debates about the client's decisions",
                explanation: "Internal discussion stays internal.",
              },
              { text: "Links to final reports", correct: true },
            ],
            explanation:
              "If the client would be surprised to read it, it does not belong in a shared channel.",
          },
        ],
      },
      behavior: { partialCredit: true },
    },
  ],
} satisfies LessonInput;
