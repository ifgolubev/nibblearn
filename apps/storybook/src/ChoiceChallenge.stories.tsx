import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChoiceChallenge, defineModule } from "@nibblearn/react";
import { choiceChallengeDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/ChoiceChallenge",
  component: ChoiceChallenge,
  args: { config: defineModule(choiceChallengeDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof ChoiceChallenge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** Shuffled options, no retries: the answer is revealed after the first check. */
export const NoRetry: Story = {
  args: {
    config: defineModule({
      ...choiceChallengeDemo,
      behavior: { ...choiceChallengeDemo.behavior, allowRetry: false, shuffleOptions: true },
    }),
  },
};

/** Compact appearance with a custom accent colour. */
export const CompactCustomAccent: Story = {
  args: {
    config: defineModule({
      ...choiceChallengeDemo,
      appearance: { compact: true, accent: "#0f766e" },
    }),
  },
};
