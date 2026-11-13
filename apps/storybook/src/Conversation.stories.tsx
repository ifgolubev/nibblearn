import type { Meta, StoryObj } from "@storybook/react-vite";
import { Conversation, defineModule } from "@nibblearn/react";
import { conversationDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Decide/Conversation",
  component: Conversation,
  args: { config: defineModule(conversationDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Conversation>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
