import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, defineModule } from "@nibblearn/react";
import { tabsDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Present/Tabs",
  component: Tabs,
  args: { config: defineModule(tabsDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
