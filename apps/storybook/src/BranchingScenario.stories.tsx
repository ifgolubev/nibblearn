import type { Meta, StoryObj } from "@storybook/react-vite";
import { BranchingScenario, defineModule } from "@nibblearn/react";
import { branchingScenarioDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Decide/BranchingScenario",
  component: BranchingScenario,
  args: { config: defineModule(branchingScenarioDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof BranchingScenario>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
