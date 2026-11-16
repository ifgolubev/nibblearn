import type { CalloutInput } from "../../schema/modules";

export const calloutDemo = {
  id: "naming-rule",
  type: "callout",
  content: {
    variant: "tip",
    title: "One naming rule for every campaign",
    text: "Name campaigns **CLIENT · CAMPAIGN · CHANNEL · MARKET**, for example `NWO · Spring Launch · Search · US`.\n\nPulse Analytics groups reports by these four parts, so a missing part hides spend from the client dashboard.",
  },
} satisfies CalloutInput;
