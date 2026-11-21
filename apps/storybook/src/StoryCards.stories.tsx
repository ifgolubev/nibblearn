import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryCards, defineModule } from "@nibblearn/react";
import { hotspotExplorerDemo, storyCardsDemo } from "@nibblearn/examples";

const meta = {
  title: "Modules/Learn/StoryCards",
  component: StoryCards,
  args: { config: defineModule(storyCardsDemo) },
  argTypes: {
    onComplete: { action: "complete" },
    onEvent: { action: "event" },
  },
} satisfies Meta<typeof StoryCards>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The demo used on the showcase site. */
export const Default: Story = {};

const dashboard = hotspotExplorerDemo.content.image;

/** Card templates: text alignment, media position, image fit and a link button. */
export const Layouts: Story = {
  args: {
    config: defineModule({
      id: "story-layouts",
      type: "story-cards",
      title: "Card templates",
      content: {
        cards: [
          {
            eyebrow: "Centered",
            title: "One idea per card",
            body: "A picture, a headline and three or four sentences. Centered text suits short, punchy cards.",
            image: dashboard,
            align: "center",
          },
          {
            eyebrow: "Media left",
            title: "Picture beside the text",
            body: "On roomy screens the card widens and the image sits beside the text.\n\nOn phones it stacks, image first.",
            image: dashboard,
            mediaPosition: "left",
            imageFit: "contain",
          },
          {
            eyebrow: "Media right",
            title: "Right-aligned text",
            body: "The image moves to the right and the text aligns towards it.",
            image: dashboard,
            mediaPosition: "right",
            imageFit: "contain",
            align: "right",
          },
          {
            eyebrow: "Media below",
            title: "Text first, picture second",
            body: "Lead with the claim, then show the evidence.",
            image: dashboard,
            mediaPosition: "bottom",
            action: {
              label: "Open the team handbook",
              href: "https://brightline.example/handbook",
            },
          },
        ],
      },
    }),
  },
};
