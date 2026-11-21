import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChoiceChallenge, defineModule } from "@nibblearn/react";
import { choiceChallengeDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/ChoiceChallenge",
  component: ChoiceChallenge,
  args: { config: defineModule(choiceChallengeDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
    onSubmit: { action: "submit" },
  },
} satisfies Meta<typeof ChoiceChallenge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** Shuffled options, no retries: the answer is revealed after the first check. */
export const NoRetry: Story = {
  args: {
    config: defineModule({
      ...choiceChallengeDemo,
      behavior: { ...choiceChallengeDemo.behavior, allowRetry: false, shuffleOptions: true },
    }),
  },
};

/** Compact appearance with a custom accent colour. */
export const CompactCustomAccent: Story = {
  args: {
    config: defineModule({
      ...choiceChallengeDemo,
      appearance: { compact: true, accent: "#0f766e" },
    }),
  },
};

const serverGraded = defineModule({
  id: "server-graded-quiz",
  type: "choice-challenge",
  title: "Metric check",
  instructions: "Answer every question, then submit. Your answers are checked on the server.",
  content: {
    questions: [
      {
        id: "q-roas",
        prompt: "ROAS compares revenue to…",
        mode: "single",
        options: [
          { id: "spend", text: "Ad spend" },
          { id: "clicks", text: "Clicks" },
          { id: "reach", text: "Reach" },
        ],
      },
      {
        id: "q-cost",
        prompt: "Which of these are cost metrics?",
        mode: "multiple",
        options: [
          { id: "cpc", text: "CPC" },
          { id: "cpm", text: "CPM" },
          { id: "ctr", text: "CTR" },
        ],
      },
      {
        id: "q-tf",
        prompt: "A higher CPA is always better.",
        mode: "single",
        options: [
          { id: "true", text: "True" },
          { id: "false", text: "False" },
        ],
      },
    ],
  },
  behavior: { evaluation: "external" },
});

/**
 * The host grades the answers: the config has no correct options, nothing is checked in the
 * browser, and `onSubmit` receives the selected option ids of every question.
 */
export const ExternalEvaluation: Story = { args: { config: serverGraded } };

/** A saved, graded attempt shown read-only from the host's data. */
export const Review: Story = {
  args: {
    config: serverGraded,
    review: {
      items: [
        {
          selected: ["clicks"],
          correct: ["spend"],
          explanation: "ROAS is **return on ad spend**: revenue divided by spend.",
          optionExplanations: { clicks: "Clicks feed CTR and CPC, not ROAS." },
        },
        { selected: ["cpc", "cpm"], correct: ["cpc", "cpm"] },
        { selected: [], correct: ["false"], explanation: "CPA is a cost: lower is better." },
      ],
    },
  },
};
