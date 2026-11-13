import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProcessExplorer, defineModule } from "@nibblearn/react";
import { processExplorerDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Explore/ProcessExplorer",
  component: ProcessExplorer,
  args: { config: defineModule(processExplorerDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof ProcessExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

/** Forced vertical layout (the default switches automatically at 720px). */
export const Vertical: Story = {
  args: {
    config: defineModule({
      ...processExplorerDemo,
      behavior: { ...processExplorerDemo.behavior, layout: "vertical" },
    }),
  },
};
