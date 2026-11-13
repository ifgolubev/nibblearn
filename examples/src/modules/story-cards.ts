import type { StoryCardsInput } from "@nibblearn/core";

export const storyCardsDemo = {
  id: "agency-welcome",
  type: "story-cards",
  title: "Welcome to the agency",
  instructions: "Six short cards to get you oriented at Brightline Media.",
  content: {
    cards: [
      {
        eyebrow: "Chapter 1",
        title: "Hello, and welcome to Brightline Media",
        layout: "cover",
        body: "We're a performance marketing agency of **48 people** across Lisbon and Tallinn.\n\nOver the next few minutes you'll meet the teams, learn how a campaign moves through the agency, and pick up the one rule every account runs on.",
      },
      {
        eyebrow: "Who we are",
        title: "Three teams, one scoreboard",
        body: "**Strategy** shapes the plan and owns the client relationship.\n\n**Creative** turns the plan into ads, landing pages and copy that earn attention.\n\n**Performance** runs the media, reads the numbers and decides what to scale next.",
        expandable: {
          label: "How the teams hand off",
          body: "A brief starts in Strategy, moves to Creative for production, and lands in Performance for launch. Every Monday the three leads review one shared dashboard. Nobody owns a metric alone, which is why the handoff notes matter more than the org chart.",
        },
      },
      {
        eyebrow: "By the numbers",
        layout: "stat",
        stat: { value: "3.4×", label: "median ROAS across retained accounts last quarter" },
        body: "That figure is why clients stay. It is also why we treat every euro of ad spend as if it were our own.",
      },
      {
        eyebrow: "From the founders",
        layout: "quote",
        title: "Mara Lindqvist, co-founder",
        body: "A good campaign is not the one with the prettiest ad. It is the one where we can explain, in one sentence, why the number moved.",
      },
      {
        eyebrow: "The one rule",
        title: "Every claim has a metric",
        body: "When you say a campaign is *working*, you say which number says so and over what period.\n\nIf you can't name the metric, the claim is a feeling. Feelings are welcome in retros, not in client reports.",
        check: {
          question: 'A teammate says the new video ads "feel strong". What\'s the right follow-up?',
          options: [
            { text: "Ask which metric moved and over what period", correct: true },
            { text: "Add the ads to the client report as a win" },
            { text: "Scale the budget while the momentum lasts" },
          ],
          explanation:
            "At Brightline Media a claim without a metric is just an impression. Ask for the number first, then decide.",
        },
      },
      {
        eyebrow: "You're set",
        title: "What happens next",
        body: "Tomorrow you'll shadow a Monday dashboard review with your team lead.\n\nBefore then, run through the **Metric deck** flashcards and the **Metric myths** quiz. Both take under ten minutes.",
        expandable: {
          label: "Your first-week checklist",
          body: "Day 1: accounts and tools access.\n\nDay 2: shadow the Monday dashboard review.\n\nDay 3: pair with Performance on one live account.\n\nDay 5: present one observation from the account to your lead. One sentence, one metric.",
        },
      },
    ],
  },
  behavior: { progressiveReveal: true, allowBack: true, showProgress: true, requireChecks: true },
  feedback: { complete: "That's the lay of the land. Welcome aboard." },
} satisfies StoryCardsInput;
