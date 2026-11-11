import type { TrueFalseInput } from "@nibblearn/core";

export const trueFalseDemo = {
  id: "metric-myths",
  type: "true-false",
  title: "Metric myths",
  instructions: "Eight quick calls. Swipe right for true, left for false, or use the buttons.",
  content: {
    statements: [
      {
        text: "CTR is calculated as clicks divided by impressions.",
        isTrue: true,
        explanation:
          "Correct. CTR compares two counts and never involves spend, which makes it a creative-relevance signal.",
        tag: "Rates",
      },
      {
        text: "A lower ROAS is always better for the client.",
        isTrue: false,
        explanation:
          "ROAS is revenue ÷ spend, so higher means more revenue per euro. Lower ROAS means the campaign returns less.",
        tag: "Return",
      },
      {
        text: "CPM tells you what 1,000 impressions cost.",
        isTrue: true,
        explanation: "Yes. The *M* stands for mille: spend ÷ impressions × 1,000.",
        tag: "Cost",
      },
      {
        text: "If CTR is high but CVR is low, the ads are probably the problem.",
        isTrue: false,
        explanation:
          "A high CTR shows the ads earn clicks. A low CVR after the click points to the landing page or the offer, not the creative.",
        tag: "Diagnosis",
      },
      {
        text: "LTV helps you decide how high a CPA you can afford.",
        isTrue: true,
        explanation:
          "Exactly. If a customer is worth €400 over their lifetime, a €60 CPA may be fine; if they're worth €50, it isn't.",
        tag: "Return",
      },
      {
        text: "Raising AOV lowers ROAS because customers spend more.",
        isTrue: false,
        explanation: "The opposite. More revenue per order on the same spend pushes ROAS up.",
        tag: "Return",
      },
      {
        text: "CPA is spend divided by the number of conversions.",
        isTrue: true,
        explanation: "Right. It's the most direct efficiency metric for an acquisition campaign.",
        tag: "Cost",
      },
      {
        text: "Doubling the budget on a campaign will double its conversions.",
        isTrue: false,
        explanation:
          "Audiences saturate and auctions get pricier. Expect CPA to rise as spend scales, which is why we scale in steps and watch the number.",
        tag: "Diagnosis",
      },
    ],
  },
  behavior: {
    swipe: true,
    trueLabel: "True",
    falseLabel: "False",
    showExplanation: true,
    shuffle: false,
  },
  feedback: {
    complete: "Myths busted. These are the eight mistakes we see most often in client decks.",
  },
} satisfies TrueFalseInput;
