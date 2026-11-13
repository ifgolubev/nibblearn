import * as examples from "@nibblearn/examples";
import type { LessonInput } from "@nibblearn/core";

export interface LessonMeta {
  id: string;
  title: string;
  description: string;
  audience: string;
  minutes: number;
  modules: string[];
  lesson: LessonInput;
}

const ex = examples as Record<string, unknown>;
const list: { key: string; meta: Omit<LessonMeta, "lesson" | "modules"> }[] = [
  {
    key: "welcomeToTheAgencyLesson",
    meta: {
      id: "welcome-to-the-agency",
      title: "Welcome to the Agency",
      description:
        "An onboarding micro-course: how the agency is structured, who does what, how projects flow, and where to find things.",
      audience: "New hires, week one",
      minutes: 8,
    },
  },
  {
    key: "launchingACampaignLesson",
    meta: {
      id: "launching-a-campaign",
      title: "Launching a Marketing Campaign",
      description:
        "From client brief to launch checklist: plan the work, sort responsibilities, explore the dashboard and catch setup mistakes.",
      audience: "Account & media teams",
      minutes: 12,
    },
  },
  {
    key: "clientCommunicationLesson",
    meta: {
      id: "client-communication",
      title: "Client Communication",
      description:
        "Scenario-based practice: unclear briefs, urgent messages, managing expectations and knowing when to escalate.",
      audience: "Everyone who talks to clients",
      minutes: 10,
    },
  },
  {
    key: "marketingMetricsLesson",
    meta: {
      id: "marketing-metrics",
      title: "Understanding Marketing Metrics",
      description:
        "CTR, CPC, CPA, conversion rate and ROAS — learn the definitions, match them, fill in the formulas and play with a simulator.",
      audience: "Juniors and non-marketers",
      minutes: 10,
    },
  },
];

export const lessons: LessonMeta[] = list
  .filter((l) => ex[l.key])
  .map((l) => {
    const lesson = ex[l.key] as LessonInput;
    return { ...l.meta, lesson, modules: lesson.modules.map((m) => m.type) };
  });

export function getLesson(id: string) {
  return lessons.find((l) => l.id === id);
}
