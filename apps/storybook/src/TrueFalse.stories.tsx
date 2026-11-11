import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrueFalse, defineModule } from "@nibblearn/react";
import { trueFalseDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/TrueFalse",
  component: TrueFalse,
  args: { config: defineModule(trueFalseDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof TrueFalse>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** Custom labels, no swipe. */
export const YesNoButtonsOnly: Story = {
  args: {
    config: defineModule({
      ...trueFalseDemo,
      behavior: { ...trueFalseDemo.behavior, swipe: false, trueLabel: "Yes", falseLabel: "No" },
    }),
  },
};
