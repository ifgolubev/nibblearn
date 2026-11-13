import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScreenshotWalkthrough, defineModule } from "@nibblearn/react";
import { screenshotWalkthroughDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Explore/ScreenshotWalkthrough",
  component: ScreenshotWalkthrough,
  args: { config: defineModule(screenshotWalkthroughDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof ScreenshotWalkthrough>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
