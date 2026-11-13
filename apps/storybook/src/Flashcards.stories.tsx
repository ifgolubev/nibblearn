import type { Meta, StoryObj } from "@storybook/react-vite";
import { Flashcards, defineModule } from "@nibblearn/react";
import { flashcardsDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Learn/Flashcards",
  component: Flashcards,
  args: { config: defineModule(flashcardsDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Flashcards>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
