import type { WhatIfSimulatorInput } from "@nibblearn/core";

export const whatIfSimulatorDemo = {
  id: "acquisition-cost-explorer",
  type: "what-if-simulator",
  title: "Acquisition cost explorer",
  instructions:
    "Drag the sliders to see how budget, bidding and conversion rate shape the cost of every new customer for a fictional paid-search campaign.",
  content: {
    currency: "USD",
    inputs: [
      {
        id: "spend",
        label: "Monthly ad spend",
        min: 1000,
        max: 50000,
        step: 500,
        default: 10000,
        format: "currency",
        help: "Total media budget for the month.",
      },
      {
        id: "cpc",
        label: "Cost per click (CPC)",
        min: 0.2,
        max: 8,
        step: 0.1,
        default: 1.5,
        format: "currency",
        help: "Average price paid for one click. Rises with competition and falls with better ad relevance.",
      },
      {
        id: "cvr",
        label: "Conversion rate",
        min: 0.005,
        max: 0.1,
        step: 0.005,
        default: 0.02,
        format: "percent",
        help: "Share of visitors who become customers. Landing-page quality moves this most.",
      },
      {
        id: "aov",
        label: "Average order value",
        min: 20,
        max: 500,
        step: 5,
        default: 80,
        format: "currency",
        help: "Revenue from a typical first order.",
      },
    ],
    outputs: [
      {
        id: "clicks",
        label: "Clicks",
        formula: "floor(spend / cpc)",
        format: "integer",
        help: "Spend ÷ CPC",
      },
      {
        id: "conversions",
        label: "Conversions",
        formula: "floor(clicks * cvr)",
        format: "integer",
        help: "Clicks × conversion rate",
      },
      {
        id: "cpa",
        label: "Cost per acquisition (CPA)",
        formula: "spend / max(conversions, 1)",
        format: "currency",
        primary: true,
        help: "What one new customer costs: spend ÷ conversions.",
      },
      {
        id: "revenue",
        label: "Revenue",
        formula: "conversions * aov",
        format: "currency",
        help: "Conversions × average order value",
      },
      {
        id: "roas",
        label: "ROAS",
        formula: "revenue / spend",
        format: "number",
        help: "Revenue earned per dollar spent",
      },
    ],
    insights: [
      {
        id: "cpa-over-aov",
        when: "cpa > aov",
        tone: "warning",
        text: "Each customer costs more than they spend on their first order. Lower the CPC, lift the conversion rate, or raise the order value before scaling budget.",
      },
      {
        id: "roas-healthy",
        when: "roas >= 3",
        tone: "success",
        text: "ROAS of **3× or more** — every dollar of spend returns at least three in revenue. This is the zone where adding budget usually pays off.",
      },
      {
        id: "cpc-high",
        when: "cpc > 4",
        tone: "info",
        text: "A CPC above $4 points to crowded auctions or a low Quality Score. Tighter keywords and more relevant ad copy tend to bring it down.",
      },
    ],
    challenge: {
      description: "Bring **CPA under $30** while keeping spend at or above **$10,000**.",
      goal: "cpa < 30 and spend >= 10000",
      successMessage:
        "You found a profitable mix. Notice that conversion rate and CPC move CPA far more than raw budget does — budget only scales whatever efficiency you already have.",
    },
  },
  behavior: { chart: "bars", completeOnInteract: true },
} satisfies WhatIfSimulatorInput;
