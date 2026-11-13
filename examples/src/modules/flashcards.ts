import type { FlashcardsInput } from "@nibblearn/core";

export const flashcardsDemo = {
  id: "metric-deck",
  type: "flashcards",
  title: "Metric deck",
  instructions:
    "Eight metrics every Brightline Media account runs on. Flip, then rate yourself honestly.",
  content: {
    cards: [
      {
        front: "CPM",
        back: "**Cost per mille** — what you pay for 1,000 ad impressions.\n\nSpend ÷ impressions × 1,000.",
        tag: "Cost",
        hint: "The *M* is the Roman numeral for a thousand.",
      },
      {
        front: "CPC",
        back: "**Cost per click** — average spend for one click on the ad.\n\nSpend ÷ clicks.",
        tag: "Cost",
      },
      {
        front: "CTR",
        back: "**Click-through rate** — the share of impressions that turned into clicks.\n\nClicks ÷ impressions. A relevance signal for the creative.",
        tag: "Rate",
        hint: "It compares two counts and never looks at spend.",
      },
      {
        front: "CPA",
        back: "**Cost per acquisition** — what one conversion (lead, signup, sale) costs.\n\nSpend ÷ conversions.",
        tag: "Cost",
      },
      {
        front: "ROAS",
        back: "**Return on ad spend** — revenue earned for every unit of spend.\n\nRevenue ÷ spend. A ROAS of 3.4× means €3.40 back per €1.",
        tag: "Return",
      },
      {
        front: "LTV",
        back: "**Lifetime value** — the total revenue (or margin) a customer brings over the whole relationship.\n\nUsed to decide how high a CPA you can afford.",
        tag: "Return",
        hint: "Think beyond the first purchase.",
      },
      {
        front: "CVR",
        back: "**Conversion rate** — the share of visitors who completed the goal.\n\nConversions ÷ clicks (or sessions). A landing-page signal.",
        tag: "Rate",
      },
      {
        front: "AOV",
        back: "**Average order value** — revenue divided by the number of orders.\n\nRaising AOV lifts ROAS without buying more traffic.",
        tag: "Return",
      },
    ],
  },
  behavior: { shuffle: false, allowShuffle: true, requireMastery: true, autoFlip: false },
  feedback: {
    complete:
      "Deck done. Those eight metrics cover almost every conversation you'll have with a client.",
  },
} satisfies FlashcardsInput;
