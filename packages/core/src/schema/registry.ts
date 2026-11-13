import type { z } from "zod";
import {
  branchingScenarioSchema,
  budgetAllocatorSchema,
  categorySortSchema,
  choiceChallengeSchema,
  conversationSchema,
  estimateSchema,
  imageCompareSchema,
  labelDiagramSchema,
  fillBlanksSchema,
  flashcardsSchema,
  hotspotExplorerSchema,
  inboxTriageSchema,
  matchPairsSchema,
  priorityMatrixSchema,
  processExplorerSchema,
  screenshotWalkthroughSchema,
  sequenceBuilderSchema,
  spotTheMistakeSchema,
  storyCardsSchema,
  trueFalseSchema,
  whatIfSimulatorSchema,
  wordBuilderSchema,
} from "./modules";

/** Category used for gallery grouping and filtering. */
export type ModuleCategory = "learn" | "practice" | "explore" | "decide" | "simulate";

export interface ModuleSchemaDefinition<S extends z.ZodType = z.ZodType> {
  /** Discriminator value used in lesson JSON (`"type": "flashcards"`). */
  type: string;
  /** Human-readable name. */
  name: string;
  description: string;
  category: ModuleCategory;
  /** Zod schema validating the full module config (including `id` and `type`). */
  schema: S;
}

export const builtInModuleDefinitions = [
  {
    type: "story-cards",
    name: "Story Cards",
    description: "Card-based micro lessons with progressive reveal and embedded checks.",
    category: "learn",
    schema: storyCardsSchema,
  },
  {
    type: "flashcards",
    name: "Flashcards",
    description: "Flip cards, mark what you know, and review the rest.",
    category: "learn",
    schema: flashcardsSchema,
  },
  {
    type: "choice-challenge",
    name: "Choice Challenge",
    description: "Single and multiple choice questions with rich feedback.",
    category: "practice",
    schema: choiceChallengeSchema,
  },
  {
    type: "true-false",
    name: "True / False",
    description: "Rapid-fire statements with swipe or button answers.",
    category: "practice",
    schema: trueFalseSchema,
  },
  {
    type: "match-pairs",
    name: "Match the Pairs",
    description: "Connect related items by tapping or dragging.",
    category: "practice",
    schema: matchPairsSchema,
  },
  {
    type: "sequence-builder",
    name: "Sequence Builder",
    description: "Arrange steps into the correct order.",
    category: "practice",
    schema: sequenceBuilderSchema,
  },
  {
    type: "category-sort",
    name: "Category Sort",
    description: "Sort items into the right buckets.",
    category: "practice",
    schema: categorySortSchema,
  },
  {
    type: "fill-blanks",
    name: "Fill in the Blanks",
    description: "Complete sentences from a word bank or by typing.",
    category: "practice",
    schema: fillBlanksSchema,
  },
  {
    type: "hotspot-explorer",
    name: "Hotspot Explorer",
    description: "Explore an image through clickable hotspots.",
    category: "explore",
    schema: hotspotExplorerSchema,
  },
  {
    type: "screenshot-walkthrough",
    name: "Screenshot Walkthrough",
    description: "Guided, click-to-advance product tours over screenshots.",
    category: "explore",
    schema: screenshotWalkthroughSchema,
  },
  {
    type: "branching-scenario",
    name: "Branching Scenario",
    description: "Decisions with consequences and multiple endings.",
    category: "decide",
    schema: branchingScenarioSchema,
  },
  {
    type: "conversation",
    name: "Simulated Conversation",
    description: "Practice replies in a realistic chat with scripted outcomes.",
    category: "decide",
    schema: conversationSchema,
  },
  {
    type: "process-explorer",
    name: "Process Explorer",
    description: "Interactive, step-by-step workflow explainer.",
    category: "explore",
    schema: processExplorerSchema,
  },
  {
    type: "spot-the-mistake",
    name: "Spot the Mistake",
    description: "Find the problems in a mock document or screenshot.",
    category: "practice",
    schema: spotTheMistakeSchema,
  },
  {
    type: "what-if-simulator",
    name: "What-If Simulator",
    description: "Move sliders and watch metrics respond in real time.",
    category: "simulate",
    schema: whatIfSimulatorSchema,
  },
  {
    type: "budget-allocator",
    name: "Budget Allocator",
    description:
      "Split a budget across channels with diminishing returns, then compare to the optimum.",
    category: "simulate",
    schema: budgetAllocatorSchema,
  },
  {
    type: "estimate",
    name: "Estimation Challenge",
    description: "Estimate a number on a scale, then see how close you were.",
    category: "practice",
    schema: estimateSchema,
  },
  {
    type: "inbox-triage",
    name: "Inbox Triage",
    description: "Work through a realistic inbox and decide what to do with every message.",
    category: "decide",
    schema: inboxTriageSchema,
  },
  {
    type: "word-builder",
    name: "Word Builder",
    description: "Tap word tiles into the right order to build a sentence or formula.",
    category: "practice",
    schema: wordBuilderSchema,
  },
  {
    type: "priority-matrix",
    name: "Priority Matrix",
    description: "Place tasks on a 2×2 matrix, such as urgent × important, then compare.",
    category: "decide",
    schema: priorityMatrixSchema,
  },
  {
    type: "label-diagram",
    name: "Label the Diagram",
    description: "Drag labels onto the parts of an image, then check your placements.",
    category: "practice",
    schema: labelDiagramSchema,
  },
  {
    type: "image-compare",
    name: "Before / After",
    description: "Drag a divider across two images to compare them and read what changed.",
    category: "explore",
    schema: imageCompareSchema,
  },
] as const satisfies readonly ModuleSchemaDefinition[];

export type BuiltInModuleType = (typeof builtInModuleDefinitions)[number]["type"];

export const builtInModuleTypes = builtInModuleDefinitions.map(
  (d) => d.type,
) as BuiltInModuleType[];

/**
 * A registry of module schemas. Custom modules can be added so that
 * `validateLesson()` accepts them.
 */
export class SchemaRegistry {
  private readonly defs = new Map<string, ModuleSchemaDefinition>();

  constructor(definitions: readonly ModuleSchemaDefinition[] = builtInModuleDefinitions) {
    for (const d of definitions) this.defs.set(d.type, d);
  }

  register(definition: ModuleSchemaDefinition): this {
    this.defs.set(definition.type, definition);
    return this;
  }

  get(type: string): ModuleSchemaDefinition | undefined {
    return this.defs.get(type);
  }

  has(type: string): boolean {
    return this.defs.has(type);
  }

  types(): string[] {
    return [...this.defs.keys()];
  }

  list(): ModuleSchemaDefinition[] {
    return [...this.defs.values()];
  }
}

export const defaultSchemaRegistry = /* @__PURE__ */ new SchemaRegistry();
