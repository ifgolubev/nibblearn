import type { Meta, StoryObj } from "@storybook/react-vite";
import { Columns, defineModule } from "@nibblearn/react";
import { columnsDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Present/Columns",
  component: Columns,
  args: { config: defineModule(columnsDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Columns>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
