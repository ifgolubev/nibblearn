import "./styles/index.css";
export { createDefaultRegistry, defaultRegistry, builtInComponents } from "./defaultRegistry";

export * from "@nibblearn/core";
export * from "./context/NibblearnProvider";
export * from "./hooks";
export * from "./primitives";
export * from "./modules/types";
export { ModuleRegistry, type ModuleDefinition, type AnyModuleDefinition } from "./registry";
export { ModuleRenderer, type ModuleRendererProps } from "./ModuleRenderer";
export { StoryCards, type StoryCardsProps } from "./modules/story-cards/StoryCards";
export { Flashcards, type FlashcardsProps } from "./modules/flashcards/Flashcards";
export {
  ChoiceChallenge,
  type ChoiceChallengeProps,
} from "./modules/choice-challenge/ChoiceChallenge";
export { TrueFalse, type TrueFalseProps } from "./modules/true-false/TrueFalse";
export { MatchPairs, type MatchPairsProps } from "./modules/match-pairs/MatchPairs";
export {
  SequenceBuilder,
  type SequenceBuilderProps,
} from "./modules/sequence-builder/SequenceBuilder";
export { CategorySort, type CategorySortProps } from "./modules/category-sort/CategorySort";
export { FillBlanks, type FillBlanksProps } from "./modules/fill-blanks/FillBlanks";
export {
  HotspotExplorer,
  type HotspotExplorerProps,
} from "./modules/hotspot-explorer/HotspotExplorer";
export {
  ScreenshotWalkthrough,
  type ScreenshotWalkthroughProps,
} from "./modules/screenshot-walkthrough/ScreenshotWalkthrough";
export {
  BranchingScenario,
  type BranchingScenarioProps,
} from "./modules/branching-scenario/BranchingScenario";
export { Conversation, type ConversationProps } from "./modules/conversation/Conversation";
export {
  ProcessExplorer,
  type ProcessExplorerProps,
} from "./modules/process-explorer/ProcessExplorer";
export {
  SpotTheMistake,
  type SpotTheMistakeProps,
} from "./modules/spot-the-mistake/SpotTheMistake";
export {
  WhatIfSimulator,
  type WhatIfSimulatorProps,
} from "./modules/what-if-simulator/WhatIfSimulator";
export {
  BudgetAllocator,
  type BudgetAllocatorProps,
} from "./modules/budget-allocator/BudgetAllocator";
export { Estimate, type EstimateProps } from "./modules/estimate/Estimate";
export { LabelDiagram, type LabelDiagramProps } from "./modules/label-diagram/LabelDiagram";
export { ImageCompare, type ImageCompareProps } from "./modules/image-compare/ImageCompare";
export { WordBuilder, type WordBuilderProps } from "./modules/word-builder/WordBuilder";
export { PriorityMatrix, type PriorityMatrixProps } from "./modules/priority-matrix/PriorityMatrix";
export { InboxTriage, type InboxTriageProps } from "./modules/inbox-triage/InboxTriage";
export { LessonPlayer, type LessonPlayerProps, type LessonCompletion } from "./player/LessonPlayer";
