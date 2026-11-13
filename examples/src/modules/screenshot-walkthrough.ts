import type { ScreenshotWalkthroughInput } from "@nibblearn/core";
import {
  crmActivityTabDataUri,
  crmContactDetailDataUri,
  crmContactSearchDataUri,
  crmContactsListDataUri,
  crmDashboardDataUri,
} from "../assets/crm-screens";

const SIZE = { width: 1200, height: 760 };

/**
 * Guided tour of the fictional "Orbit CRM" used in agency onboarding.
 * Target rectangles are percentages of the 1200×760 mock screens in `assets/crm-screens.ts`.
 */
export const screenshotWalkthroughDemo = {
  id: "orbit-crm-call-note",
  type: "screenshot-walkthrough",
  title: "Find a client's last call note",
  instructions:
    "Every account manager logs calls in Orbit CRM. Follow the steps to find what Maya from Northwind Bakery said on her last call.",
  content: {
    steps: [
      {
        id: "open-contacts",
        image: {
          src: crmDashboardDataUri,
          alt: "Orbit CRM dashboard with the sidebar navigation on the left.",
          ...SIZE,
        },
        title: "Open your contacts",
        instruction: "Click **Contacts** in the sidebar.",
        target: { x: 1, y: 17.9, width: 16.3, height: 5.3 },
        action: "click",
        note: "The sidebar is the same on every page, so you can jump to Contacts from anywhere.",
      },
      {
        id: "search-maya",
        image: {
          src: crmContactsListDataUri,
          alt: "Contacts list showing six people and a search box in the top bar.",
          ...SIZE,
        },
        title: "Search for the client",
        instruction: "Type **Maya** into the search box and press Enter.",
        target: { x: 33.3, y: 1.3, width: 33.3, height: 4.7 },
        action: "type",
        input: { placeholder: "Search contacts, deals, tasks…", expected: "Maya" },
        note: "Search matches first names, last names and companies, so a first name is usually enough.",
      },
      {
        id: "open-contact",
        image: {
          src: crmContactSearchDataUri,
          alt: "Contacts list filtered to one result: Maya Lindqvist.",
          ...SIZE,
        },
        title: "Open the contact",
        instruction: "Click the row for **Maya Lindqvist** to open her profile.",
        target: { x: 20.3, y: 24.5, width: 77.7, height: 7.4 },
        action: "click",
      },
      {
        id: "activity-tab",
        image: {
          src: crmContactDetailDataUri,
          alt: "Maya Lindqvist's profile with Overview, Activity and Deals tabs.",
          ...SIZE,
        },
        title: "Go to the activity timeline",
        instruction: "Switch to the **Activity** tab.",
        target: { x: 32.2, y: 22.4, width: 8.5, height: 5.3 },
        action: "click",
        note: "Overview shows static details. Activity is where calls, emails and meetings are logged in order.",
      },
      {
        id: "read-note",
        image: {
          src: crmActivityTabDataUri,
          alt: "Activity timeline with the most recent call note at the top.",
          ...SIZE,
        },
        title: "Review the last call note",
        instruction:
          "Read the most recent **call note** at the top of the timeline. Maya wants the first creative concepts by next Thursday.",
        target: { x: 22.3, y: 31.6, width: 73.5, height: 11.8 },
        action: "observe",
        tooltipPlacement: "bottom",
        note: "Call notes are what the creative team reads before a kickoff. Keep them short and concrete.",
      },
    ],
    summary:
      "You can now find any client's latest conversation in under a minute. Next time, try the same path for **Tomas Herrera**.",
  },
  behavior: { allowHint: true, autoHintAfterMisses: 2, showStepNumbers: true, allowBack: true },
} satisfies ScreenshotWalkthroughInput;
