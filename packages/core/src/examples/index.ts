/**
 * Starter content for authoring tools: a realistic example and a minimal blank config for
 * every built-in module. Import from "@nibblearn/core/examples" (kept out of the main entry so
 * apps that only render lessons do not ship the example data).
 */
import type { BuiltInModuleType } from "../schema/registry";
import { emptyModules } from "./empty";
import {
  branchingScenarioDemo,
  budgetAllocatorDemo,
  categorySortDemo,
  choiceChallengeDemo,
  conversationDemo,
  estimateDemo,
  fillBlanksDemo,
  flashcardsDemo,
  hotspotExplorerDemo,
  imageCompareDemo,
  inboxTriageDemo,
  labelDiagramDemo,
  matchPairsDemo,
  priorityMatrixDemo,
  processExplorerDemo,
  screenshotWalkthroughDemo,
  sequenceBuilderDemo,
  spotTheMistakeDemo,
  storyCardsDemo,
  trueFalseDemo,
  whatIfSimulatorDemo,
  wordBuilderDemo,
  calloutDemo,
  accordionDemo,
  tabsDemo,
  carouselDemo,
  columnsDemo,
} from "./modules";
import type { ModuleInputFor, ModuleInputMap } from "./types";

export * from "./modules";
export { emptyModules, PLACEHOLDER_IMAGE_SRC } from "./empty";
export type { ModuleInputFor, ModuleInputMap } from "./types";

/** The example config of every built-in module, keyed by type. Treat as read-only. */
export const moduleExamples: ModuleInputMap = {
  "story-cards": storyCardsDemo,
  flashcards: flashcardsDemo,
  "choice-challenge": choiceChallengeDemo,
  "true-false": trueFalseDemo,
  "match-pairs": matchPairsDemo,
  "sequence-builder": sequenceBuilderDemo,
  "category-sort": categorySortDemo,
  "fill-blanks": fillBlanksDemo,
  "hotspot-explorer": hotspotExplorerDemo,
  "screenshot-walkthrough": screenshotWalkthroughDemo,
  "branching-scenario": branchingScenarioDemo,
  conversation: conversationDemo,
  "process-explorer": processExplorerDemo,
  "spot-the-mistake": spotTheMistakeDemo,
  "what-if-simulator": whatIfSimulatorDemo,
  "budget-allocator": budgetAllocatorDemo,
  estimate: estimateDemo,
  "inbox-triage": inboxTriageDemo,
  "label-diagram": labelDiagramDemo,
  "image-compare": imageCompareDemo,
  "word-builder": wordBuilderDemo,
  "priority-matrix": priorityMatrixDemo,
  callout: calloutDemo,
  accordion: accordionDemo,
  tabs: tabsDemo,
  carousel: carouselDemo,
  columns: columnsDemo,
};

export interface CreateOptions {
  /** Module id. Defaults to "<type>-example" / "<type>-new". */
  id?: string;
}

const hasOwn = (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key);

function copy<T extends BuiltInModuleType>(
  source: ModuleInputMap,
  type: T,
  id: string,
): ModuleInputFor<T> {
  if (!hasOwn(source, type)) throw new TypeError(`unknown built-in module type "${type}"`);
  const config = structuredClone(source[type]) as ModuleInputFor<T>;
  return { ...config, id };
}

/** A realistic, fully written example of a built-in module. Returns a fresh deep copy. */
export function createExample<T extends BuiltInModuleType>(
  type: T,
  options: CreateOptions = {},
): ModuleInputFor<T> {
  return copy(moduleExamples, type, options.id ?? `${type}-example`);
}

/** The smallest valid config of a built-in module, with placeholder text. Returns a fresh deep copy. */
export function createEmpty<T extends BuiltInModuleType>(
  type: T,
  options: CreateOptions = {},
): ModuleInputFor<T> {
  return copy(emptyModules, type, options.id ?? `${type}-new`);
}
