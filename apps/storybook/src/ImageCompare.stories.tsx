import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImageCompare, defineModule } from "@nibblearn/react";
import { imageCompareDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Explore/ImageCompare",
  component: ImageCompare,
  args: { config: defineModule(imageCompareDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof ImageCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** Free exploration: no question, no explore requirement — a Finish button appears. */
export const ExploreOnly: Story = {
  args: {
    config: defineModule({
      ...imageCompareDemo,
      id: "cro-sprint-landing-explore",
      content: { ...imageCompareDemo.content, question: undefined },
      behavior: { initialPosition: 70, requireExplore: false },
    }),
  },
};
