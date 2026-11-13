import type { Meta, StoryObj } from "@storybook/react-vite";
import { FillBlanks, defineModule } from "@nibblearn/react";
import { fillBlanksDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/FillBlanks",
  component: FillBlanks,
  args: { config: defineModule(fillBlanksDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof FillBlanks>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** Typed-answer mode instead of the word bank. */
export const TypedMode: Story = {
  args: {
    config: defineModule({
      ...fillBlanksDemo,
      behavior: { ...fillBlanksDemo.behavior, mode: "typed" },
    }),
  },
};
