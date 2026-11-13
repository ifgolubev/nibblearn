import type { Meta, StoryObj } from "@storybook/react-vite";
import { HotspotExplorer, defineModule } from "@nibblearn/react";
import { hotspotExplorerDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Explore/HotspotExplorer",
  component: HotspotExplorer,
  args: { config: defineModule(hotspotExplorerDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof HotspotExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
