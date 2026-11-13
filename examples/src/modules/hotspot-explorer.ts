import type { HotspotExplorerInput } from "@nibblearn/core";
import { analyticsDashboardDataUri } from "../assets/analytics-dashboard";

export const hotspotExplorerDemo = {
  id: "pulse-dashboard-tour",
  type: "hotspot-explorer",
  title: "Tour the Pulse Analytics overview",
  instructions:
    "This is the dashboard you will open every Monday. Explore the six markers to learn what each area tells you.",
  content: {
    image: {
      src: analyticsDashboardDataUri,
      alt: "Pulse Analytics overview dashboard for the Northwind Outdoor account, March 2026",
      width: 1200,
      height: 760,
    },
    hotspots: [
      {
        id: "date-range",
        x: 94.6,
        y: 5.4,
        label: "Date range picker",
        title: "Always check the date range first",
        description:
          "Every number on the page is scoped to this range. Client reports use **calendar months**; the Compare toggle next to it overlays the previous period so you can explain *why* a metric moved.",
        placement: "bottom",
      },
      {
        id: "kpi-spend",
        x: 36.7,
        y: 16.3,
        label: "Spend card",
        title: "Spend",
        description:
          "Total media cost across all channels — $48,200 this month. The red pill shows spend is **up 6.2%** on February. Spend going up is not a problem by itself; read it together with ROAS and CPA.",
      },
      {
        id: "kpi-roas",
        x: 56.3,
        y: 16.3,
        label: "ROAS card",
        title: "ROAS — return on ad spend",
        description:
          "Revenue ÷ spend. **3.4×** means every dollar spent returned $3.40 in revenue. Northwind's target is 3.0×, so green here is genuinely good news.",
      },
      {
        id: "trend-chart",
        x: 20.8,
        y: 30.5,
        width: 45.8,
        height: 37.9,
        shape: "rect",
        label: "Daily spend vs. revenue chart",
        title: "Daily trend",
        description:
          "Purple is spend, green is revenue. Look for the two lines **diverging** — that is efficiency improving. The dashed *Bid change* marker on 15 March is an annotation left by the account team; add one whenever you change something that could move the lines.",
        placement: "right",
      },
      {
        id: "channel-table",
        x: 95,
        y: 34.5,
        label: "Channel breakdown table",
        title: "Channel breakdown",
        description:
          "Spend and ROAS per channel. Email has the highest ROAS (6.8×) but the smallest spend — a classic signal that it is **under-invested**. Display at 1.9× is below target and worth a conversation.",
        placement: "left",
      },
      {
        id: "nav-attribution",
        x: 16.7,
        y: 36.7,
        label: "Attribution section in the sidebar",
        title: "Attribution",
        description:
          "Channel ROAS on this page uses *last click*. Open **Attribution** when a client asks why Paid social looks weak — the data-driven model there usually gives social more credit for assisted conversions.",
        placement: "right",
      },
    ],
  },
  behavior: { requireAll: true, numbered: true, pulse: true },
  feedback: {
    complete: "You now know every area of the overview. Next up: reading a channel report.",
  },
} satisfies HotspotExplorerInput;
