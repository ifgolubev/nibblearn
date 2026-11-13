import * as examples from "@nibblearn/examples";

type AnyDemo = { id: string; type: string; [k: string]: unknown };

const map: Record<string, AnyDemo | undefined> = {
  "story-cards": (examples as Record<string, unknown>).storyCardsDemo as AnyDemo | undefined,
  flashcards: (examples as Record<string, unknown>).flashcardsDemo as AnyDemo | undefined,
  "choice-challenge": (examples as Record<string, unknown>).choiceChallengeDemo as
    AnyDemo | undefined,
  "true-false": (examples as Record<string, unknown>).trueFalseDemo as AnyDemo | undefined,
  "match-pairs": (examples as Record<string, unknown>).matchPairsDemo as AnyDemo | undefined,
  "sequence-builder": (examples as Record<string, unknown>).sequenceBuilderDemo as
    AnyDemo | undefined,
  "category-sort": (examples as Record<string, unknown>).categorySortDemo as AnyDemo | undefined,
  "fill-blanks": (examples as Record<string, unknown>).fillBlanksDemo as AnyDemo | undefined,
  "hotspot-explorer": (examples as Record<string, unknown>).hotspotExplorerDemo as
    AnyDemo | undefined,
  "screenshot-walkthrough": (examples as Record<string, unknown>).screenshotWalkthroughDemo as
    AnyDemo | undefined,
  "branching-scenario": (examples as Record<string, unknown>).branchingScenarioDemo as
    AnyDemo | undefined,
  conversation: (examples as Record<string, unknown>).conversationDemo as AnyDemo | undefined,
  "process-explorer": (examples as Record<string, unknown>).processExplorerDemo as
    AnyDemo | undefined,
  "spot-the-mistake": (examples as Record<string, unknown>).spotTheMistakeDemo as
    AnyDemo | undefined,
  "what-if-simulator": (examples as Record<string, unknown>).whatIfSimulatorDemo as
    AnyDemo | undefined,
  "budget-allocator": (examples as Record<string, unknown>).budgetAllocatorDemo as
    AnyDemo | undefined,
  estimate: (examples as Record<string, unknown>).estimateDemo as AnyDemo | undefined,
  "label-diagram": (examples as Record<string, unknown>).labelDiagramDemo as AnyDemo | undefined,
  "image-compare": (examples as Record<string, unknown>).imageCompareDemo as AnyDemo | undefined,
  "word-builder": (examples as Record<string, unknown>).wordBuilderDemo as AnyDemo | undefined,
  "priority-matrix": (examples as Record<string, unknown>).priorityMatrixDemo as
    AnyDemo | undefined,
  "inbox-triage": (examples as Record<string, unknown>).inboxTriageDemo as AnyDemo | undefined,
};

/** Demo config for a module type (undefined if not available). */
export function getDemo(type: string): AnyDemo | undefined {
  return map[type];
}

export function listDemos(): AnyDemo[] {
  return Object.values(map).filter((d): d is AnyDemo => Boolean(d));
}
