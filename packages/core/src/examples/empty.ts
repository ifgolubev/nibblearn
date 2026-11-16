import type { ModuleInputFor, ModuleInputMap } from "./types";

/** Neutral 16:9 grey placeholder used wherever a module requires an image. */
export const PLACEHOLDER_IMAGE_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'%3E%3Crect width='1600' height='900' fill='%23e4e4e7'/%3E%3C/svg%3E";

const image = () => ({
  src: PLACEHOLDER_IMAGE_SRC,
  alt: "Placeholder image",
  width: 1600,
  height: 900,
});

/**
 * The smallest valid config for every built-in module, with English placeholder text.
 * Ids are fixed strings so the result is deterministic; `createEmpty()` replaces the module id.
 */
export const emptyModules: ModuleInputMap = {
  "story-cards": {
    id: "story-cards-new",
    type: "story-cards",
    title: "Story",
    content: { cards: [{ title: "Card title", body: "Card text" }] },
  },
  flashcards: {
    id: "flashcards-new",
    type: "flashcards",
    title: "Flashcards",
    content: { cards: [{ front: "Term", back: "Definition" }] },
  },
  "choice-challenge": {
    id: "choice-challenge-new",
    type: "choice-challenge",
    title: "Quiz",
    content: {
      questions: [
        {
          prompt: "Question",
          options: [{ text: "Option 1", correct: true }, { text: "Option 2" }],
        },
      ],
    },
  },
  "true-false": {
    id: "true-false-new",
    type: "true-false",
    title: "True or false",
    content: { statements: [{ text: "Statement", isTrue: true }] },
  },
  "match-pairs": {
    id: "match-pairs-new",
    type: "match-pairs",
    title: "Match the pairs",
    content: {
      pairs: [
        { left: "Term 1", right: "Definition 1" },
        { left: "Term 2", right: "Definition 2" },
      ],
    },
  },
  "sequence-builder": {
    id: "sequence-builder-new",
    type: "sequence-builder",
    title: "Put the steps in order",
    content: {
      items: [
        { id: "step-1", text: "Step 1" },
        { id: "step-2", text: "Step 2" },
      ],
    },
  },
  "category-sort": {
    id: "category-sort-new",
    type: "category-sort",
    title: "Sort the items",
    content: {
      categories: [
        { id: "category-1", label: "Category 1" },
        { id: "category-2", label: "Category 2" },
      ],
      items: [
        { id: "item-1", text: "Item 1", categoryId: "category-1" },
        { id: "item-2", text: "Item 2", categoryId: "category-2" },
      ],
    },
  },
  "fill-blanks": {
    id: "fill-blanks-new",
    type: "fill-blanks",
    title: "Fill in the blanks",
    content: {
      template: "The answer is {{blank-1}}.",
      blanks: [{ id: "blank-1", answers: ["answer"] }],
    },
  },
  "hotspot-explorer": {
    id: "hotspot-explorer-new",
    type: "hotspot-explorer",
    title: "Explore the image",
    content: {
      image: image(),
      hotspots: [{ id: "hotspot-1", x: 50, y: 50, label: "Hotspot", description: "Description" }],
    },
  },
  "screenshot-walkthrough": {
    id: "screenshot-walkthrough-new",
    type: "screenshot-walkthrough",
    title: "Walkthrough",
    content: {
      steps: [
        {
          id: "step-1",
          image: image(),
          instruction: "Click the highlighted area",
          target: { x: 40, y: 40, width: 20, height: 20 },
        },
      ],
    },
  },
  "branching-scenario": {
    id: "branching-scenario-new",
    type: "branching-scenario",
    title: "Scenario",
    content: {
      start: "start",
      nodes: [
        {
          id: "start",
          text: "Situation",
          choices: [{ text: "Choice", next: "end" }],
        },
        { id: "end", kind: "ending", text: "Outcome", outcome: "success" },
      ],
    },
  },
  conversation: {
    id: "conversation-new",
    type: "conversation",
    title: "Conversation",
    content: {
      contact: { name: "Contact" },
      start: "start",
      nodes: [
        {
          id: "start",
          messages: [{ text: "Message" }],
          responses: [{ text: "Reply", next: "end" }],
        },
        { id: "end", messages: [{ text: "Final message" }], outcome: "success" },
      ],
    },
  },
  "process-explorer": {
    id: "process-explorer-new",
    type: "process-explorer",
    title: "Process",
    content: {
      stages: [
        { id: "stage-1", title: "Stage 1", details: "Details" },
        { id: "stage-2", title: "Stage 2", details: "Details" },
      ],
    },
  },
  "spot-the-mistake": {
    id: "spot-the-mistake-new",
    type: "spot-the-mistake",
    title: "Spot the mistake",
    content: {
      canvas: {
        kind: "document",
        title: "Document",
        rows: [
          { id: "row-1", label: "Field 1", value: "Value 1" },
          { id: "row-2", label: "Field 2", value: "Value 2" },
        ],
      },
      mistakes: [{ targetId: "row-1", explanation: "Explanation" }],
    },
  },
  "what-if-simulator": {
    id: "what-if-simulator-new",
    type: "what-if-simulator",
    title: "What if",
    content: {
      inputs: [{ id: "input", label: "Input", min: 0, max: 100, default: 50 }],
      outputs: [{ id: "output", label: "Output", formula: "input * 2" }],
    },
  },
  "budget-allocator": {
    id: "budget-allocator-new",
    type: "budget-allocator",
    title: "Allocate the budget",
    content: {
      totalBudget: 10000,
      kpiLabel: "Results",
      channels: [
        { id: "channel-1", label: "Channel 1", efficiency: 10, saturation: 0.7 },
        { id: "channel-2", label: "Channel 2", efficiency: 8, saturation: 0.8 },
        { id: "channel-3", label: "Channel 3", efficiency: 6, saturation: 0.9 },
      ],
      initial: { "channel-1": 40, "channel-2": 30, "channel-3": 30 },
    },
  },
  estimate: {
    id: "estimate-new",
    type: "estimate",
    title: "Estimate",
    content: { questions: [{ prompt: "Question", min: 0, max: 100, answer: 50 }] },
  },
  "inbox-triage": {
    id: "inbox-triage-new",
    type: "inbox-triage",
    title: "Inbox",
    content: {
      owner: { name: "You" },
      actions: [
        { id: "reply", label: "Reply" },
        { id: "archive", label: "Archive" },
      ],
      messages: [1, 2, 3].map((n) => ({
        id: `message-${n}`,
        from: { name: `Sender ${n}` },
        subject: `Subject ${n}`,
        preview: "Preview",
        body: "Message text",
        time: "09:00",
        correctAction: n === 1 ? "reply" : "archive",
        explanation: "Explanation",
      })),
    },
  },
  "word-builder": {
    id: "word-builder-new",
    type: "word-builder",
    title: "Build the sentence",
    content: { items: [{ prompt: "Prompt", tokens: ["Word", "order"] }] },
  },
  "priority-matrix": {
    id: "priority-matrix-new",
    type: "priority-matrix",
    title: "Prioritise",
    content: {
      axes: {
        x: { label: "Urgency", low: "Low", high: "High" },
        y: { label: "Importance", low: "Low", high: "High" },
      },
      quadrants: [
        { id: "do", position: "top-right", label: "Do" },
        { id: "plan", position: "top-left", label: "Plan" },
        { id: "delegate", position: "bottom-right", label: "Delegate" },
        { id: "drop", position: "bottom-left", label: "Drop" },
      ],
      items: [
        { id: "item-1", text: "Item 1", quadrantId: "do" },
        { id: "item-2", text: "Item 2", quadrantId: "plan" },
        { id: "item-3", text: "Item 3", quadrantId: "drop" },
      ],
    },
  },
  "label-diagram": {
    id: "label-diagram-new",
    type: "label-diagram",
    title: "Label the diagram",
    content: {
      image: image(),
      targets: [
        { id: "target-1", x: 30, y: 50, label: "Label 1" },
        { id: "target-2", x: 70, y: 50, label: "Label 2" },
      ],
    },
  },
  "image-compare": {
    id: "image-compare-new",
    type: "image-compare",
    title: "Compare",
    content: {
      before: { image: image() },
      after: { image: image() },
    },
  },
  callout: {
    id: "callout-new",
    type: "callout",
    content: { variant: "info", text: "Callout text" },
  },
  accordion: {
    id: "accordion-new",
    type: "accordion",
    title: "Accordion",
    content: { items: [{ id: "item-1", title: "Panel title", text: "Panel text" }] },
  },
  tabs: {
    id: "tabs-new",
    type: "tabs",
    title: "Tabs",
    content: {
      tabs: [
        { id: "tab-1", label: "Tab 1", text: "Tab text" },
        { id: "tab-2", label: "Tab 2", text: "Tab text" },
      ],
    },
  },
  carousel: {
    id: "carousel-new",
    type: "carousel",
    title: "Carousel",
    content: { slides: [{ id: "slide-1", title: "Slide title", text: "Slide text" }] },
  },
  columns: {
    id: "columns-new",
    type: "columns",
    content: {
      columns: [
        { id: "column-1", title: "Column 1", text: "Column text" },
        { id: "column-2", title: "Column 2", text: "Column text" },
      ],
    },
  },
} satisfies { [T in keyof ModuleInputMap]: ModuleInputFor<T> };
