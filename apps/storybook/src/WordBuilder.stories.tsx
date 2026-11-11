import type { Meta, StoryObj } from "@storybook/react-vite";
import { WordBuilder, defineModule } from "@nibblearn/react";
import { wordBuilderDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/WordBuilder",
  component: WordBuilder,
  args: { config: defineModule(wordBuilderDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof WordBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** A single sentence item: no counter or progress bar. */
export const SingleSentence: Story = {
  args: {
    config: defineModule({
      ...wordBuilderDemo,
      id: "build-it-right-single",
      content: { items: [wordBuilderDemo.content.items[2]!] },
    }),
  },
};
