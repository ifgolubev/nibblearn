import type { Meta, StoryObj } from "@storybook/react-vite";
import { LessonPlayer, createMemoryStorage } from "@nibblearn/react";
import {
  clientCommunicationLesson,
  launchingACampaignLesson,
  marketingMetricsLesson,
  welcomeToTheAgencyLesson,
} from "@nibblearn/examples";

const meta = {
  title: "Lesson Player",
  component: LessonPlayer,
  // Memory storage keeps stories independent from each other and from localStorage.
  args: { lesson: welcomeToTheAgencyLesson, storage: createMemoryStorage() },
  argTypes: {
    onComplete: { action: "lesson complete" },
    onModuleComplete: { action: "module complete" },
    onEvent: { action: "event" },
    lesson: { control: false },
    storage: { control: false },
  },
} satisfies Meta<typeof LessonPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WelcomeToTheAgency: Story = {};
export const LaunchingACampaign: Story = { args: { lesson: launchingACampaignLesson } };
export const ClientCommunication: Story = { args: { lesson: clientCommunicationLesson } };
export const MarketingMetrics: Story = { args: { lesson: marketingMetricsLesson } };

/** Skips the intro screen. */
export const AutoStart: Story = { args: { autoStart: true } };

/** Unframed, for embedding inside an existing page layout. */
export const Unframed: Story = { args: { framed: false } };

/** Invalid lesson JSON renders readable validation errors instead of crashing. */
export const InvalidLesson: Story = {
  args: { lesson: { schemaVersion: 1, id: "broken", title: "", modules: [] } },
};
