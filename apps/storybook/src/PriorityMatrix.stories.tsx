import type { Meta, StoryObj } from "@storybook/react-vite";
import { PriorityMatrix, defineModule } from "@nibblearn/react";
import { priorityMatrixDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Decide/PriorityMatrix",
  component: PriorityMatrix,
  args: { config: defineModule(priorityMatrixDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof PriorityMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** One attempt only: a wrong check reveals the expert placement straight away. */
export const SingleAttempt: Story = {
  args: {
    config: defineModule({
      ...priorityMatrixDemo,
      id: "monday-morning-triage-strict",
      behavior: { ...priorityMatrixDemo.behavior, maxAttempts: 1, shuffle: false },
    }),
  },
};
