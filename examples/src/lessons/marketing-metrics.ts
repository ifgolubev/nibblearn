import type { LessonInput } from "@nibblearn/core";
import { flashcardsDemo } from "../modules/flashcards";
import { matchPairsDemo } from "../modules/match-pairs";
import { fillBlanksDemo } from "../modules/fill-blanks";
import { whatIfSimulatorDemo } from "../modules/what-if-simulator";
import { trueFalseDemo } from "../modules/true-false";

/** Example D — Understanding Marketing Metrics. */
export const marketingMetricsLesson = {
  schemaVersion: 1,
  id: "marketing-metrics",
  title: "Understanding Marketing Metrics",
  description:
    "CTR, CPC, CPA, conversion rate and ROAS: learn what each one means, match them to definitions, complete the formulas, and see how they move together in a simulator. All figures are illustrative.",
  objectives: [
    "Define CTR, CPC, CPA, conversion rate and ROAS",
    "Calculate each metric from campaign data",
    "Explain how spend, CPC and conversion rate drive CPA",
    "Reason about budget allocation with ROAS",
  ],
  intro: { show: true, estimatedMinutes: 10 },
  gamification: { points: true, celebration: true, streaks: true },
  completion: { rule: "score", threshold: 0.6 },
  modules: [
    { ...flashcardsDemo, id: "metrics-deck" },
    { ...matchPairsDemo, id: "metrics-match" },
    { ...fillBlanksDemo, id: "metrics-formulas" },
    { ...trueFalseDemo, id: "metrics-myths" },
    { ...whatIfSimulatorDemo, id: "metrics-simulator" },
    {
      id: "budget-allocation",
      type: "choice-challenge",
      title: "Allocate the budget",
      instructions: "Illustrative numbers from two channels in the same month.",
      content: {
        questions: [
          {
            prompt:
              "Search: $10,000 spend, $42,000 revenue. Social: $10,000 spend, $18,000 revenue. The client adds $5,000. Where does it go?",
            context: "ROAS — Search 4.2×, Social 1.8×. Assume both channels still have headroom.",
            options: [
              {
                text: "All of it to Search",
                correct: true,
                explanation: "With headroom, the higher-ROAS channel earns the marginal dollar.",
              },
              {
                text: "Split it evenly",
                explanation: "Even splits feel fair but ignore the 2.4× difference in return.",
              },
              {
                text: "All of it to Social, to help it catch up",
                explanation: "Spending more on the weaker channel does not make it stronger.",
              },
            ],
            explanation:
              "Marginal budget follows marginal return — until the stronger channel runs out of headroom.",
          },
          {
            prompt:
              "Which metrics would you watch to notice that Search has run out of headroom? Select all that apply.",
            options: [
              { text: "Rising CPC", correct: true },
              { text: "Falling conversion rate", correct: true },
              {
                text: "Rising CTR",
                explanation: "A rising CTR is good news, not a saturation signal.",
              },
              { text: "Flattening revenue as spend grows", correct: true },
            ],
            explanation:
              "Saturation shows up as more expensive clicks, weaker conversion and flat revenue.",
          },
        ],
      },
    },
  ],
} satisfies LessonInput;
