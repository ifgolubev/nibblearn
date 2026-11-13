import type { Meta, StoryObj } from "@storybook/react-vite";
import { CategorySort, defineModule } from "@nibblearn/react";
import { categorySortDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/CategorySort",
  component: CategorySort,
  args: { config: defineModule(categorySortDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof CategorySort>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
