import type { Meta, StoryObj } from "@storybook/react-vite";
import { Estimate, defineModule } from "@nibblearn/react";
import { estimateDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/Estimate",
  component: Estimate,
  args: { config: defineModule(estimateDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Estimate>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** A single question: no counter or progress bar. */
export const SingleQuestion: Story = {
  args: {
    config: defineModule({
      ...estimateDemo,
      id: "benchmark-instincts-single",
      content: { ...estimateDemo.content, questions: [estimateDemo.content.questions[1]!] },
    }),
  },
};
