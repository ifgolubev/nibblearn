import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCards, defineModule } from "@nibblearn/react";
import { storyCardsDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Learn/StoryCards",
  component: StoryCards,
  args: { config: defineModule(storyCardsDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof StoryCards>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
