import type { ImageCompareInput } from "@nibblearn/core";
import { landingAfterDataUri, landingBeforeDataUri } from "../assets/landing-pages";

export const imageCompareDemo = {
  id: "cro-sprint-landing",
  type: "image-compare",
  title: "Landing page: before and after the CRO sprint",
  instructions:
    "Northwind Outdoor's trail-guide page converted 2.1% of visitors into sign-ups. After a two-week sprint, Brightline Media relaunched it (illustrative figures). Drag the handle to compare the versions and open the numbered notes.",
  content: {
    before: {
      label: "Before",
      image: {
        src: landingBeforeDataUri,
        alt: "Before: a busy landing page with a promo strip, ten navigation links, a carousel with a small headline and three different buttons, three promo tiles and a nine-field form in the sidebar.",
        width: 1200,
        height: 800,
      },
    },
    after: {
      label: "After",
      image: {
        src: landingAfterDataUri,
        alt: "After: a focused landing page with a large headline, a three-field form with one orange button, a product image of the trail guide and a backpack, and a dark trust bar with ratings.",
        width: 1200,
        height: 800,
      },
    },
    annotations: [
      {
        id: "carousel-headline",
        x: 41,
        y: 22.8,
        side: "before",
        title: "A headline lost in a carousel",
        text: "The only mention of the trail guide sits in small type on a rotating slide. Most visitors never see slide two, so the page's one promise gets a few seconds at best.",
      },
      {
        id: "competing-ctas",
        x: 41.5,
        y: 32.3,
        side: "before",
        title: "Three buttons, three directions",
        text: "**Shop now**, **Learn more** and **Find a store** all compete with the form. Each one is a polite exit from the page's real goal: the sign-up.",
      },
      {
        id: "long-form",
        x: 83,
        y: 50,
        side: "before",
        title: "Nine fields before any value",
        text: "Date of birth, phone and a full postal address — just to receive a free PDF. Every extra field is effort and a privacy question the visitor has to answer before getting anything back.",
      },
      {
        id: "short-form",
        x: 42.5,
        y: 66,
        side: "after",
        title: "Three fields, one button",
        text: "The form now asks only for what the guide needs, and its button is the **only** call to action on the page. The headline above it states the promise in five words.",
      },
      {
        id: "trust-bar",
        x: 72,
        y: 87,
        side: "after",
        title: "Proof next to the decision",
        text: "Ratings and subscriber numbers sit right under the form, answering “is this worth my email?” at the moment the visitor decides.",
      },
    ],
    question: {
      prompt:
        "Sign-ups rose from 2.1% to 4.6% of visitors. Which change most likely lifted conversion the most?",
      options: [
        {
          text: "Cutting the form from nine fields to three",
          correct: true,
          explanation:
            "Yes. On a sign-up page the form **is** the conversion, and each field is a cost paid before any reward. Removing six — especially date of birth and full address — strips out the effort and privacy worries that make people abandon.",
        },
        {
          text: "Replacing three buttons with a single call to action",
          explanation:
            "Focus helps: the old buttons led people away from the form. But visitors who did reach the form still faced nine fields — the bigger barrier sat there.",
        },
        {
          text: "Swapping the carousel for a static product hero",
          explanation:
            "A static hero keeps the message on screen and loads faster, but on its own it seldom moves sign-ups as much as removing effort from the form.",
        },
        {
          text: "Adding the ratings and subscriber trust bar",
          explanation:
            "Social proof reassures people at the moment of decision. It supports the change, but reassurance cannot make up for a form that asks too much.",
        },
      ],
      explanation:
        "In a real sprint you would test these changes separately (or in a multivariate test) to know each one's share of the lift.",
    },
    takeaway:
      "Good CRO removes friction before it adds persuasion: cut what you ask for, make one action obvious, then put proof right next to it.",
  },
} satisfies ImageCompareInput;
