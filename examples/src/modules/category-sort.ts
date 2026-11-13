import type { CategorySortInput } from "@nibblearn/core";

export const categorySortDemo = {
  id: "who-does-what",
  type: "category-sort",
  title: "Who does what at Brightline Media",
  instructions:
    "Sort each activity into the team that owns it. Drag an item into a category, or tap the item and then the category.",
  content: {
    categories: [
      {
        id: "strategy",
        label: "Strategy",
        description: "Objectives, audiences and the plan",
        color: "accent",
      },
      {
        id: "media",
        label: "Media Buying",
        description: "Running the money in-platform",
        color: "warning",
      },
      {
        id: "analytics",
        label: "Analytics",
        description: "Tracking, measurement and insight",
        color: "info",
      },
      {
        id: "account",
        label: "Account Management",
        description: "The client relationship",
        color: "success",
      },
    ],
    items: [
      {
        id: "brief",
        text: "Translate the client brief into campaign objectives",
        categoryId: "strategy",
        explanation:
          "Strategy turns the brief into measurable objectives before any channel is chosen.",
      },
      {
        id: "bids",
        text: "Adjust bids and budgets in the ad platforms",
        categoryId: "media",
        explanation: "In-flight bid and budget changes are hands-on-keyboard media buying work.",
      },
      {
        id: "pixel",
        text: "Install and verify conversion tracking",
        categoryId: "analytics",
        explanation:
          "Analytics owns the tracking stack so that every team reports from the same numbers.",
      },
      {
        id: "qbr",
        text: "Run the quarterly business review with the client",
        categoryId: "account",
        explanation:
          "QBRs are a relationship ritual led by the account team, with input from the others.",
      },
      {
        id: "personas",
        text: "Define target audience personas",
        categoryId: "strategy",
        explanation: "Personas are a planning artefact that media and creative then act on.",
      },
      {
        id: "placements",
        text: "Choose placements and exclude low-quality inventory",
        categoryId: "media",
        explanation:
          "Placement selection and brand-safety exclusions are configured by the buyers.",
      },
      {
        id: "dashboard",
        text: "Build the weekly performance dashboard",
        categoryId: "analytics",
        explanation:
          "Dashboards are an analytics deliverable, even though account managers present them.",
      },
      {
        id: "scope",
        text: "Negotiate scope changes and invoicing",
        categoryId: "account",
        explanation:
          "Commercial conversations about scope and billing sit with account management.",
      },
      {
        id: "attribution",
        text: "Pick the attribution model for reporting",
        categoryId: "analytics",
        explanation:
          "Attribution is a measurement decision; analytics recommends it, strategy signs it off.",
      },
      {
        id: "channelmix",
        text: "Recommend the channel mix and budget split",
        categoryId: "strategy",
        explanation:
          "The channel mix is a strategic recommendation that media buying then executes.",
      },
    ],
    hint: "Ask who would be blamed if the task went wrong: the planner, the buyer, the analyst or the client lead.",
  },
  behavior: { allowRetry: true, maxAttempts: 3, showExplanation: true, shuffle: true },
  feedback: {
    complete:
      "You now know who to ask for what. Expect to hand off work across all four teams in your first month.",
  },
} satisfies CategorySortInput;
