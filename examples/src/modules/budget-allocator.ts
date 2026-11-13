import type { BudgetAllocatorInput } from "@nibblearn/core";

export const budgetAllocatorDemo = {
  id: "spring-media-plan",
  type: "budget-allocator",
  title: "Spring media plan",
  instructions:
    "Brightline Media is planning Northwind Outdoor's spring push. Split the **$120,000** budget across five channels to get the most conversions, then lock in your plan and compare it with the optimum. Response curves and figures are illustrative.",
  content: {
    totalBudget: 120000,
    currency: "USD",
    kpiLabel: "Conversions",
    channels: [
      {
        id: "programmatic",
        label: "Programmatic display",
        description:
          "Open-exchange banners with audience targeting. Cheap reach that tires quickly.",
        color: "accent",
        efficiency: 100,
        saturation: 0.62,
      },
      {
        id: "ctv",
        label: "Premium CTV",
        description:
          "Living-room reach on premium streaming apps (about $38 CPM). Scales steadily.",
        color: "violet",
        efficiency: 33,
        saturation: 0.9,
      },
      {
        id: "audio",
        label: "Streaming audio",
        description:
          "Podcast and music-streaming spots. Great for recall, light on direct response.",
        color: "pink",
        efficiency: 54,
        saturation: 0.5,
      },
      {
        id: "dooh",
        label: "Digital out-of-home",
        description:
          "Screens near trailheads and outdoor retailers. 5% minimum agreed with the media owner.",
        color: "warning",
        efficiency: 14,
        saturation: 0.75,
        min: 5,
      },
      {
        id: "search-social",
        label: "Search & social",
        description:
          "High-intent search plus paid social. Converts best, but inventory caps out at 45%.",
        color: "success",
        efficiency: 360,
        saturation: 0.48,
        max: 45,
      },
    ],
    initial: { programmatic: 20, ctv: 20, audio: 20, dooh: 20, "search-social": 20 },
    goal: {
      description: "Reach at least **3,800 conversions** from the same $120,000.",
      minKpi: 3800,
    },
    explanation:
      "Search & social converts best per dollar, but its curve flattens fast and inventory caps it at 45%. Premium CTV looks expensive at first, yet its response is almost a straight line, so it keeps earning while cheaper channels saturate. The optimal plan here puts **45%** in search & social, **30%** in CTV and **15%** in programmatic, and keeps audio and out-of-home at token levels.\n\nThe rule of thumb: give the next dollar to whichever channel has the highest *marginal* return, not the best average.",
  },
  behavior: { step: 5, allowLock: true, showOptimal: true, scoreAgainstOptimal: true },
  feedback: {
    complete:
      "Every plan trades reach for efficiency. Keep the marginal-return habit when you build the real Northwind flowchart.",
  },
} satisfies BudgetAllocatorInput;
