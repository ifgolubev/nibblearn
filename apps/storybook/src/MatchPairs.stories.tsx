import type { Meta, StoryObj } from "@storybook/react-vite";
import { MatchPairs, defineModule } from "@nibblearn/react";
import { matchPairsDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/MatchPairs",
  component: MatchPairs,
  args: { config: defineModule(matchPairsDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof MatchPairs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
