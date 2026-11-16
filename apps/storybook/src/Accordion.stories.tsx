import type { Meta, StoryObj } from "@storybook/react-vite";
import { Accordion, defineModule } from "@nibblearn/react";
import { accordionDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Present/Accordion",
  component: Accordion,
  args: { config: defineModule(accordionDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
