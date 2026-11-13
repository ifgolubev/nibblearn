import type { LabelDiagramInput } from "@nibblearn/core";
import { displayAdDataUri } from "../assets/display-ad";

export const labelDiagramDemo = {
  id: "display-ad-anatomy",
  type: "label-diagram",
  title: "Anatomy of a display ad",
  instructions:
    "Brightline Media is reviewing Northwind Outdoor's spring banner. Drag each label onto the numbered part of the ad — or tap a label, then a zone. Two labels belong nowhere on the creative.",
  content: {
    image: {
      src: displayAdDataUri,
      alt: "Northwind Outdoor spring sale banner: logo top left, the headline “Trails are calling.”, a round −25% spring gear badge, a backpack and tent illustration, an orange “Shop the sale” button and two lines of small print.",
      width: 1200,
      height: 700,
    },
    targets: [
      {
        id: "logo",
        x: 27.5,
        y: 9.4,
        label: "Logo",
        explanation:
          "The logo tells people **who is talking** before they read a word. Most banners get under two seconds of attention, so brand recognition is often the only thing that sticks — keep it clear and in the same corner across every size.",
      },
      {
        id: "headline",
        x: 34.2,
        y: 42.9,
        label: "Headline",
        explanation:
          "The headline carries the **one idea** of the ad. Three words read at a glance; anything much longer than six tends to be skipped at banner sizes.",
      },
      {
        id: "offer",
        x: 83,
        y: 18.3,
        label: "Offer",
        explanation:
          "The offer gives a **reason to act now**. A specific number (−25%) beats vague promises like “great savings”, and it must match what the landing page delivers or the click is wasted.",
      },
      {
        id: "product",
        x: 75.3,
        y: 54.3,
        label: "Product shot",
        explanation:
          "The product shot shows **what is being sold** and sets the mood. One clear hero product reads better at small sizes than a busy collage.",
      },
      {
        id: "cta",
        x: 29,
        y: 70.9,
        label: "Call to action",
        explanation:
          "The call to action tells people **what happens next**. A high-contrast button with a verb (“Shop the sale”) makes the ad feel clickable and sets expectations for the landing page.",
      },
      {
        id: "disclaimer",
        x: 49.2,
        y: 92.4,
        label: "Disclaimer",
        explanation:
          "The disclaimer holds the **terms of the offer**: dates, exclusions and who the advertiser is. Small, but it keeps the ad honest and compliant — so it still has to be legible.",
      },
    ],
    distractors: ["Tracking pixel", "Frequency cap"],
    explanation:
      "Not everything in a campaign is visible: a **tracking pixel** is an invisible 1×1 image that reports views, and a **frequency cap** is an ad-server setting that limits how often one person sees the ad. Neither appears on the creative itself.",
  },
  behavior: { maxAttempts: 3 },
} satisfies LabelDiagramInput;
