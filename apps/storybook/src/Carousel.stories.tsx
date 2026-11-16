import type { Meta, StoryObj } from "@storybook/react-vite";
import { Carousel, defineModule } from "@nibblearn/react";
import { carouselDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Present/Carousel",
  component: Carousel,
  args: { config: defineModule(carouselDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};
