import type { Meta, StoryObj } from "@storybook/react-vite";
import { LabelDiagram, defineModule } from "@nibblearn/react";
import { labelDiagramDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Practice/LabelDiagram",
  component: LabelDiagram,
  args: { config: defineModule(labelDiagramDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof LabelDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** No distractors, one attempt: the right labels are shown straight after checking. */
export const SingleAttempt: Story = {
  args: {
    config: defineModule({
      ...labelDiagramDemo,
      id: "display-ad-anatomy-single",
      content: { ...labelDiagramDemo.content, distractors: [] },
      behavior: { maxAttempts: 1, shuffleSeed: 7 },
    }),
  },
};

/** Narrow container: zones render as a numbered list under the image. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 380 }}>
        <Story />
      </div>
    ),
  ],
};
