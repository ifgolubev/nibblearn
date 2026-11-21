import type { z } from "zod";
import type { ResolvedToTextOptions, TextNode } from "../to-text/nodes";
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
  calloutSchema,
  accordionSchema,
  tabsSchema,
  carouselSchema,
  columnsSchema,
} from "./modules";

/** Category used for gallery grouping and filtering. */
export type ModuleCategory = "learn" | "practice" | "explore" | "decide" | "simulate" | "present";

export interface ModuleSchemaDefinition<S extends z.ZodType = z.ZodType> {
  /** Discriminator value used in lesson JSON (`"type": "flashcards"`). */
  type: string;
  /** Human-readable name. */
  name: string;
  description: string;
  category: ModuleCategory;
  /** Icon name from the Lucide set in kebab-case, e.g. "list-checks". See `ModuleIcon` in @nibblearn/react. */
  icon?: string;
  /** Zod schema validating the full module config (including `id` and `type`). */
  schema: S;
  /**
   * Top-level config fields this module does not use (e.g. `feedback` and `scoring` for a block
   * that is never answered). They stay valid in JSON; generated forms do not show them
   * (`x-ui.widget: "hidden"` in the module's JSON Schema).
   */
  unusedFields?: readonly string[];
  /** Current schema version of this module type. Default 1. */
  version?: number;
  /**
   * Upgrades for stored configs: `migrations[n]` turns a version-n config into version n + 1.
   * Functions must return a new object and must not mutate their argument.
   */
  migrations?: Readonly<Record<number, ModuleMigration>>;
  /**
   * Text representation for `moduleToText()` (search, previews, AI). Receives the parsed config.
   * Without it, learner-facing strings are collected generically.
   */
  // Method syntax keeps definitions with different schemas assignable to each other.
  toText?(config: z.infer<S>, options: ResolvedToTextOptions): TextNode[];
}

/** Upgrades a module config by one schema version. */
export type ModuleMigration = (config: Record<string, unknown>) => Record<string, unknown>;

/** Content blocks are read, not answered: they show no feedback and have no score. */
const UNSCORED_BLOCK_FIELDS = ["feedback", "scoring"] as const;

export const builtInModuleDefinitions = [
  {
    type: "story-cards",
    name: "Story Cards",
    description: "Card-based micro lessons with progressive reveal and embedded checks.",
    category: "learn",
    icon: "book-open",
    schema: storyCardsSchema,
  },
  {
    type: "flashcards",
    name: "Flashcards",
    description: "Flip cards, mark what you know, and review the rest.",
    category: "learn",
    icon: "layers",
    schema: flashcardsSchema,
  },
  {
    type: "choice-challenge",
    name: "Choice Challenge",
    description: "Single and multiple choice questions with rich feedback.",
    category: "practice",
    icon: "list-checks",
    schema: choiceChallengeSchema,
  },
  {
    type: "true-false",
    name: "True / False",
    description: "Rapid-fire statements with swipe or button answers.",
    category: "practice",
    icon: "toggle-left",
    schema: trueFalseSchema,
  },
  {
    type: "match-pairs",
    name: "Match the Pairs",
    description: "Connect related items by tapping or dragging.",
    category: "practice",
    icon: "git-compare-arrows",
    schema: matchPairsSchema,
  },
  {
    type: "sequence-builder",
    name: "Sequence Builder",
    description: "Arrange steps into the correct order.",
    category: "practice",
    icon: "list-ordered",
    schema: sequenceBuilderSchema,
  },
  {
    type: "category-sort",
    name: "Category Sort",
    description: "Sort items into the right buckets.",
    category: "practice",
    icon: "columns-3",
    schema: categorySortSchema,
  },
  {
    type: "fill-blanks",
    name: "Fill in the Blanks",
    description: "Complete sentences from a word bank or by typing.",
    category: "practice",
    icon: "text-cursor-input",
    schema: fillBlanksSchema,
  },
  {
    type: "hotspot-explorer",
    name: "Hotspot Explorer",
    description: "Explore an image through clickable hotspots.",
    category: "explore",
    icon: "mouse-pointer-click",
    schema: hotspotExplorerSchema,
  },
  {
    type: "screenshot-walkthrough",
    name: "Screenshot Walkthrough",
    description: "Guided, click-to-advance product tours over screenshots.",
    category: "explore",
    icon: "app-window",
    schema: screenshotWalkthroughSchema,
  },
  {
    type: "branching-scenario",
    name: "Branching Scenario",
    description: "Decisions with consequences and multiple endings.",
    category: "decide",
    icon: "git-branch",
    schema: branchingScenarioSchema,
  },
  {
    type: "conversation",
    name: "Simulated Conversation",
    description: "Practice replies in a realistic chat with scripted outcomes.",
    category: "decide",
    icon: "messages-square",
    schema: conversationSchema,
  },
  {
    type: "process-explorer",
    name: "Process Explorer",
    description: "Interactive, step-by-step workflow explainer.",
    category: "explore",
    icon: "workflow",
    schema: processExplorerSchema,
  },
  {
    type: "spot-the-mistake",
    name: "Spot the Mistake",
    description: "Find the problems in a mock document or screenshot.",
    category: "practice",
    icon: "scan-search",
    schema: spotTheMistakeSchema,
  },
  {
    type: "what-if-simulator",
    name: "What-If Simulator",
    description: "Move sliders and watch metrics respond in real time.",
    category: "simulate",
    icon: "sliders-horizontal",
    schema: whatIfSimulatorSchema,
  },
  {
    type: "budget-allocator",
    name: "Budget Allocator",
    description:
      "Split a budget across channels with diminishing returns, then compare to the optimum.",
    category: "simulate",
    icon: "chart-pie",
    schema: budgetAllocatorSchema,
  },
  {
    type: "estimate",
    name: "Estimation Challenge",
    description: "Estimate a number on a scale, then see how close you were.",
    category: "practice",
    icon: "crosshair",
    schema: estimateSchema,
  },
  {
    type: "inbox-triage",
    name: "Inbox Triage",
    description: "Work through a realistic inbox and decide what to do with every message.",
    category: "decide",
    icon: "inbox",
    schema: inboxTriageSchema,
  },
  {
    type: "word-builder",
    name: "Word Builder",
    description: "Tap word tiles into the right order to build a sentence or formula.",
    category: "practice",
    icon: "whole-word",
    schema: wordBuilderSchema,
  },
  {
    type: "priority-matrix",
    name: "Priority Matrix",
    description: "Place tasks on a 2×2 matrix, such as urgent × important, then compare.",
    category: "decide",
    icon: "grid-2x2",
    schema: priorityMatrixSchema,
  },
  {
    type: "label-diagram",
    name: "Label the Diagram",
    description: "Drag labels onto the parts of an image, then check your placements.",
    category: "practice",
    icon: "tags",
    schema: labelDiagramSchema,
  },
  {
    type: "image-compare",
    name: "Before / After",
    description: "Drag a divider across two images to compare them and read what changed.",
    category: "explore",
    icon: "square-split-horizontal",
    schema: imageCompareSchema,
  },
  {
    type: "callout",
    name: "Callout",
    description: "A highlighted note, tip or warning inside the lesson text.",
    category: "present",
    icon: "message-square-warning",
    schema: calloutSchema,
    unusedFields: UNSCORED_BLOCK_FIELDS,
  },
  {
    type: "accordion",
    name: "Accordion",
    description: "Collapsible panels for details the learner can open when needed.",
    category: "present",
    icon: "list-collapse",
    schema: accordionSchema,
    unusedFields: UNSCORED_BLOCK_FIELDS,
  },
  {
    type: "tabs",
    name: "Tabs",
    description: "Parallel views of one topic, one tab at a time.",
    category: "present",
    icon: "panel-top",
    schema: tabsSchema,
    unusedFields: UNSCORED_BLOCK_FIELDS,
  },
  {
    type: "carousel",
    name: "Carousel",
    description: "A sequence of slides with text and images, navigated at the learner's pace.",
    category: "present",
    icon: "gallery-horizontal",
    schema: carouselSchema,
    unusedFields: UNSCORED_BLOCK_FIELDS,
  },
  {
    type: "columns",
    name: "Columns",
    description: "Two to four columns side by side, stacking on small screens.",
    category: "present",
    icon: "columns-2",
    schema: columnsSchema,
    unusedFields: UNSCORED_BLOCK_FIELDS,
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
