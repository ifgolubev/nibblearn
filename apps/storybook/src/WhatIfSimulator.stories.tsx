import type { Meta, StoryObj } from "@storybook/react-vite";
import { WhatIfSimulator, defineModule } from "@nibblearn/react";
import { whatIfSimulatorDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Simulate/WhatIfSimulator",
  component: WhatIfSimulator,
  args: { config: defineModule(whatIfSimulatorDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof WhatIfSimulator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
