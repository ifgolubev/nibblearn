import type { SpotTheMistakeInput } from "@nibblearn/core";

export const spotTheMistakeDemo = {
  id: "campaign-setup-review",
  type: "spot-the-mistake",
  title: "Campaign setup review",
  instructions:
    "A junior buyer has prepared this search campaign for Northwind Outdoor. Three things would break it at launch. Select each field you believe is wrong.",
  content: {
    canvas: {
      kind: "document",
      title: "Campaign setup — Spring Launch · Search",
      subtitle: "Pulse Ads · Draft #4 · prepared by J. Okafor · awaiting QA sign-off",
      rows: [
        {
          id: "name",
          label: "Campaign name",
          value: "NWO · Spring Launch · Search · US",
          section: "Basics",
          note: "Naming convention: CLIENT · CAMPAIGN · CHANNEL · MARKET",
        },
        {
          id: "objective",
          label: "Objective",
          value: "Sales — online purchases",
          section: "Basics",
        },
        {
          id: "budget",
          label: "Daily budget",
          value: "250.00",
          section: "Budget",
          note: "≈ 7,750.00 per month",
        },
        {
          id: "currency",
          label: "Currency",
          value: "EUR",
          section: "Budget",
          note: "Account billing currency: USD",
        },
        { id: "start", label: "Start date", value: "2026-04-01", section: "Schedule" },
        {
          id: "end",
          label: "End date",
          value: "2026-03-15",
          section: "Schedule",
          note: "Campaign pauses automatically at 23:59 account time",
        },
        {
          id: "targeting",
          label: "Targeting",
          value: "United States · English · All devices",
          section: "Audience",
        },
        {
          id: "bid",
          label: "Bid strategy",
          value: "Maximize conversions · Target CPA 22.00",
          section: "Audience",
          note: "Current CPA on the account: 21.40",
        },
        {
          id: "tracking",
          label: "Tracking template",
          value: "{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign=spring_launch_2026",
          section: "Tracking",
        },
        {
          id: "utm",
          label: "UTM campaign",
          value: "spring_launch_2026",
          section: "Tracking",
          note: "Must match the Pulse Analytics campaign key",
        },
        {
          id: "landing",
          label: "Landing URL",
          value: "https://northwind-outdoor.example/spring-lauch",
          section: "Tracking",
          note: "Live page: /spring-launch",
        },
      ],
    },
    mistakes: [
      {
        targetId: "currency",
        title: "Currency mismatch",
        hint: "The account bills in one currency. Which field disagrees with it?",
        explanation:
          "The account bills in **USD** but the campaign is set to EUR. The platform would reject the draft or, worse, convert the budget at launch — a 250 EUR daily budget is about 270 USD, blowing the approved plan.",
      },
      {
        targetId: "end",
        title: "Ends before it starts",
        hint: "Read the schedule as a timeline.",
        explanation:
          "The end date (15 March) is **before** the start date (1 April). The campaign would never serve. End dates should be at least the full flight: 30 April for a one-month spring launch.",
      },
      {
        targetId: "landing",
        title: "Broken landing URL",
        explanation:
          "The path is spelled `/spring-lauch` — the live page is `/spring-launch`. Every click would land on a 404 while still being billed. Always paste the URL from the browser, never retype it.",
      },
    ],
    summary:
      "Three small fields, three ways to waste the first week of a launch. Before sign-off, read the budget block, the schedule block and the tracking block as a whole — mismatches show up when you compare fields, not when you check them one by one.",
  },
  behavior: { checkMode: "instant", allowHints: true, allowRetry: true, maxWrong: 0 },
  feedback: {
    complete:
      "Sharp eyes. This is exactly the QA pass every Brightline campaign gets before launch.",
  },
} satisfies SpotTheMistakeInput;
