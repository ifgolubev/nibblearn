import { builtInModuleDefinitions } from "@nibblearn/core";
import { ModuleRegistry, type ModuleDefinition } from "./registry";
import type { ModuleComponent } from "./modules/types";
import { StoryCards } from "./modules/story-cards/StoryCards";
import { Flashcards } from "./modules/flashcards/Flashcards";
import { ChoiceChallenge } from "./modules/choice-challenge/ChoiceChallenge";
import { TrueFalse } from "./modules/true-false/TrueFalse";
import { MatchPairs } from "./modules/match-pairs/MatchPairs";
import { SequenceBuilder } from "./modules/sequence-builder/SequenceBuilder";
import { CategorySort } from "./modules/category-sort/CategorySort";
import { FillBlanks } from "./modules/fill-blanks/FillBlanks";
import { HotspotExplorer } from "./modules/hotspot-explorer/HotspotExplorer";
import { ScreenshotWalkthrough } from "./modules/screenshot-walkthrough/ScreenshotWalkthrough";
import { BranchingScenario } from "./modules/branching-scenario/BranchingScenario";
import { Conversation } from "./modules/conversation/Conversation";
import { ProcessExplorer } from "./modules/process-explorer/ProcessExplorer";
import { SpotTheMistake } from "./modules/spot-the-mistake/SpotTheMistake";
import { WhatIfSimulator } from "./modules/what-if-simulator/WhatIfSimulator";
import { BudgetAllocator } from "./modules/budget-allocator/BudgetAllocator";
import { Estimate } from "./modules/estimate/Estimate";
import { LabelDiagram } from "./modules/label-diagram/LabelDiagram";
import { ImageCompare } from "./modules/image-compare/ImageCompare";
import { WordBuilder } from "./modules/word-builder/WordBuilder";
import { PriorityMatrix } from "./modules/priority-matrix/PriorityMatrix";
import { InboxTriage } from "./modules/inbox-triage/InboxTriage";

/** Built-in module components, keyed by type. */
export const builtInComponents: Record<string, ModuleComponent<never>> = {
  "story-cards": StoryCards,
  flashcards: Flashcards,
  "choice-challenge": ChoiceChallenge,
  "true-false": TrueFalse,
  "match-pairs": MatchPairs,
  "sequence-builder": SequenceBuilder,
  "category-sort": CategorySort,
  "fill-blanks": FillBlanks,
  "hotspot-explorer": HotspotExplorer,
  "screenshot-walkthrough": ScreenshotWalkthrough,
  "branching-scenario": BranchingScenario,
  conversation: Conversation,
  "process-explorer": ProcessExplorer,
  "spot-the-mistake": SpotTheMistake,
  "what-if-simulator": WhatIfSimulator,
  "budget-allocator": BudgetAllocator,
  estimate: Estimate,
  "label-diagram": LabelDiagram,
  "image-compare": ImageCompare,
  "word-builder": WordBuilder,
  "priority-matrix": PriorityMatrix,
  "inbox-triage": InboxTriage,
};

/** Create a registry pre-populated with all built-in modules. */
export function createDefaultRegistry(): ModuleRegistry {
  const defs = builtInModuleDefinitions
    .filter((d) => d.type in builtInComponents)
    .map((d) => ({ ...d, component: builtInComponents[d.type] }) as ModuleDefinition);
  return new ModuleRegistry(defs);
}

/** Registry containing every built-in module. */
// PURE: lets bundlers drop the registry (and with it every module) when an app only
// imports individual components.
export const defaultRegistry = /* @__PURE__ */ createDefaultRegistry();
