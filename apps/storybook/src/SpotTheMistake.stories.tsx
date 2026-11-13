import type { Meta, StoryObj } from "@storybook/react-vite";
import { SpotTheMistake, defineModule } from "@nibblearn/react";
import { spotTheMistakeDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/SpotTheMistake",
  component: SpotTheMistake,
  args: { config: defineModule(spotTheMistakeDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof SpotTheMistake>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
