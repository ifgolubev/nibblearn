import type { FillBlanksInput } from "@nibblearn/core";

export const fillBlanksDemo = {
  id: "metric-formulas",
  type: "fill-blanks",
  title: "Complete the metric formulas",
  instructions:
    "Tap a word to drop it into the next blank. Tap a filled blank to put the word back.",
  content: {
    template:
      "**ROAS** is revenue divided by {{roas}}, so a ROAS of 3.4× means every dollar brought back $3.40. " +
      "**CPA** is spend divided by the number of {{cpa}} — it tells you what each result cost. " +
      "**CTR** is {{clicks}} divided by {{impressions}}, which makes it a quick read on how relevant an ad is to the people who saw it.",
    blanks: [
      {
        id: "roas",
        answers: ["ad spend", "spend"],
        hint: "ROAS stands for *return on ad spend* — the denominator is in the name.",
        explanation:
          "ROAS = revenue ÷ ad spend. It ignores margin, so pair it with CPA when judging profitability.",
      },
      {
        id: "cpa",
        answers: ["conversions", "acquisitions"],
        hint: "The *A* in CPA is the outcome you pay for: a purchase, a sign-up, a lead.",
        explanation:
          "CPA = spend ÷ conversions. Define what counts as a conversion before comparing campaigns.",
      },
      {
        id: "clicks",
        answers: ["clicks"],
        hint: "CTR starts with *click*.",
      },
      {
        id: "impressions",
        answers: ["impressions"],
        hint: "You can only click an ad after it has been shown — that showing has a name.",
        explanation:
          "CTR = clicks ÷ impressions. A CTR of 2.8% means 28 clicks for every 1,000 impressions.",
      },
    ],
    distractors: ["sessions", "followers", "page views"],
    explanation:
      "ROAS tells you how much revenue each unit of spend returned, CPA tells you what each result cost, and CTR tells you how often people who saw the ad clicked it. Together they describe return, efficiency and relevance.",
  },
  behavior: { mode: "word-bank", shuffleBank: true, allowRetry: true, maxAttempts: 3 },
  feedback: {
    correct: "Those are the three formulas every Brightline account manager should know by heart.",
    complete: "Nice — you can now read a Pulse Analytics overview without a glossary.",
  },
} satisfies FillBlanksInput;
