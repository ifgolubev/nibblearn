import type { Meta, StoryObj } from "@storybook/react-vite";
import { BudgetAllocator, defineModule } from "@nibblearn/react";
import { budgetAllocatorDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Simulate/BudgetAllocator",
  component: BudgetAllocator,
  args: { config: defineModule(budgetAllocatorDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof BudgetAllocator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** No locks and no optimal-plan reveal; scored by progress towards the goal. */
export const GoalOnly: Story = {
  args: {
    config: defineModule({
      ...budgetAllocatorDemo,
      id: "spring-media-plan-goal-only",
      behavior: { step: 5, allowLock: false, showOptimal: false, scoreAgainstOptimal: false },
    }),
  },
};
