import type { Meta, StoryObj } from "@storybook/react-vite";
import { Flashcards, defineModule } from "@nibblearn/react";
import { flashcardsDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Learn/Flashcards",
  component: Flashcards,
  args: { config: defineModule(flashcardsDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Flashcards>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** Cards with an explanation under the answer on the back side. */
export const WithExplanation: Story = {
  args: {
    config: defineModule({
      id: "flashcards-explained",
      type: "flashcards",
      title: "Metric deck",
      content: {
        cards: [
          {
            front: "ROAS",
            back: "Return on ad spend",
            tag: "Metric",
            explanation:
              "Revenue divided by ad spend. A ROAS of **3.4×** means $3.40 came back for every dollar spent.",
          },
          {
            front:
              "What does CPA measure, and when does a rising CPA become a problem for an account?",
            back: "Cost per acquisition: ad spend divided by the number of conversions it produced.",
            explanation:
              "It becomes a problem once it passes the margin on a sale. Compare it with the client's target, not with last month alone.",
          },
        ],
      },
    }),
  },
};
