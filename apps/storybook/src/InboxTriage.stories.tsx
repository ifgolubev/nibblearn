import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxTriage, defineModule } from "@nibblearn/react";
import { inboxTriageDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Decide/InboxTriage",
  component: InboxTriage,
  args: { config: defineModule(inboxTriageDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof InboxTriage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site: instant coaching after every decision. */
export const Default: Story = {};

/** Assessment-centre style: no coaching until the results, decisions can be changed. */
export const FeedbackAtEnd: Story = {
  args: {
    config: defineModule({
      ...inboxTriageDemo,
      id: "monday-inbox-end",
      behavior: { feedback: "end", allowRetry: true, showScore: true },
    }),
  },
};

/** Narrow container: the list opens messages full-width with a Back button. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380 }}>
        <Story />
      </div>
    ),
  ],
};
