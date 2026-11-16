import type { Meta, StoryObj } from "@storybook/react-vite";
import { Callout, defineModule } from "@nibblearn/react";
import { calloutDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Present/Callout",
  component: Callout,
  args: { config: defineModule(calloutDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
