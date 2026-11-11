import type { ProcessExplorerInput } from "@nibblearn/core";

/** The lifecycle of a paid campaign at a marketing agency, from brief to reporting. */
export const processExplorerDemo = {
  id: "campaign-lifecycle",
  type: "process-explorer",
  title: "How a campaign moves through the agency",
  instructions:
    "Select each stage to see who owns it, how long it takes and what has to be true before it starts.",
  content: {
    stages: [
      {
        id: "brief",
        title: "Client brief",
        summary: "Goals, audience, budget and timing are agreed.",
        icon: "clipboard-list",
        owner: "Account team",
        duration: "1–2 days",
        details:
          "The account manager runs a 45-minute briefing call and turns it into a one-page brief. A brief is only *done* when the client has signed off on the objective, the primary KPI and the budget.\n\nAmbiguous briefs are the number one cause of rework later, so push back on vague goals like “more awareness” until they become measurable.",
        checklist: [
          "One measurable objective and primary KPI",
          "Budget and flight dates confirmed",
          "Audience and exclusions written down",
          "Brief signed off by the client",
        ],
      },
      {
        id: "strategy",
        title: "Strategy",
        summary: "Channels, messaging angles and a media split are proposed.",
        icon: "compass",
        owner: "Strategy lead",
        duration: "3–4 days",
        dependsOn: ["brief"],
        details:
          "Strategy translates the brief into a plan: which channels, what the core message is, how the budget splits across them and what results are realistic.\n\nThe output is a short deck plus a media plan spreadsheet with projected reach, clicks and cost per result for each channel.",
        checklist: [
          "Channel mix with rationale",
          "Messaging angles per audience",
          "Media plan with projections",
          "Client approval recorded",
        ],
      },
      {
        id: "creative",
        title: "Creative production",
        summary: "Copy, visuals and video are produced in every required format.",
        icon: "palette",
        owner: "Creative team",
        duration: "1–2 weeks",
        dependsOn: ["strategy"],
        details:
          "Designers and copywriters produce the assets listed in the media plan: static images, short video cuts and ad copy variants. Every asset is reviewed against the brand guide before it goes to the client.\n\nAim for at least **three** distinct concepts per audience so optimisation has something to choose between.",
        checklist: [
          "Concepts approved internally",
          "Assets exported in every placement size",
          "Copy variants proof-read",
          "Client approval on final assets",
        ],
      },
      {
        id: "tracking",
        title: "Tracking setup",
        summary: "Pixels, conversions and UTM naming are verified before spend starts.",
        icon: "radar",
        owner: "Analytics",
        duration: "2 days",
        dependsOn: ["strategy"],
        details:
          "Nothing launches without working measurement. Analytics installs or verifies pixels, defines conversion events and applies the agency UTM convention to every link.\n\nA test conversion is recorded in each platform and in the client's analytics before the launch checklist is signed.",
        checklist: [
          "Pixels firing on all key pages",
          "Conversion events defined and tested",
          "UTM parameters follow the naming convention",
          "Dashboard connected to live data",
        ],
      },
      {
        id: "launch",
        title: "Launch",
        summary: "Campaigns go live after a four-eyes check.",
        icon: "rocket",
        owner: "Media buyer",
        duration: "1 day",
        dependsOn: ["creative", "tracking"],
        details:
          "The media buyer builds the campaigns, a second person reviews targeting, budgets and links, and the campaigns go live. The first 24 hours are watched closely for delivery issues and disapproved ads.\n\nThe client gets a short launch confirmation with screenshots of the live ads.",
        checklist: [
          "Four-eyes check completed",
          "Daily budgets match the media plan",
          "Launch confirmation sent to the client",
        ],
      },
      {
        id: "optimisation",
        title: "Optimisation",
        summary: "Budgets and creative are adjusted weekly against the KPI.",
        icon: "sliders-horizontal",
        owner: "Media buyer",
        duration: "Ongoing",
        dependsOn: ["launch"],
        details:
          "Each week the media buyer reviews performance against the plan, shifts budget towards what works and pauses what does not. Creative fatigue usually shows after two to three weeks: when frequency climbs and click-through drops, the team requests a creative refresh.",
        checklist: [
          "Weekly performance review logged",
          "Budget shifts documented",
          "Underperforming ads paused",
          "Creative refresh requested when fatigue appears",
        ],
        branches: [{ label: "Request a creative refresh", to: "creative" }],
      },
      {
        id: "reporting",
        title: "Reporting",
        summary: "Results, learnings and next steps are shared with the client.",
        icon: "bar-chart-3",
        owner: "Account team",
        duration: "2 days",
        dependsOn: ["optimisation"],
        details:
          "At the end of the flight the account team compiles a report: results against the KPI, what was learned about audiences and creative, and a recommendation for the next campaign.\n\nThe best reports lead with **three insights**, not thirty charts.",
        checklist: [
          "Results vs. KPI and projections",
          "Three key learnings",
          "Recommendation for the next campaign",
          "Report presented live to the client",
        ],
      },
    ],
  },
  behavior: { layout: "auto", requireAll: true },
} satisfies ProcessExplorerInput;
