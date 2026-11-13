import type { Meta, StoryObj } from "@storybook/react-vite";
import { SequenceBuilder, defineModule } from "@nibblearn/react";
import { sequenceBuilderDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/SequenceBuilder",
  component: SequenceBuilder,
  args: { config: defineModule(sequenceBuilderDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof SequenceBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
