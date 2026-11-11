/** Build the React usage snippet for a module demo. */
export function reactSnippet(componentName: string, type: string, id: string): string {
  return `import { ${componentName}, defineModule } from "@nibblearn/react";
import "@nibblearn/react/styles.css";
import json from "./${type}.json"; // the JSON shown above

// defineModule validates the JSON and infers the config type.
const config = defineModule(json);

export function Activity() {
  return (
    <${componentName}
      config={config}
      onComplete={(result) => console.log("completed", result)}
      onEvent={(event) => console.log(event.type, event.payload)}
    />
  );
}

// Or render any config by its "type" field without importing the component:
// <ModuleRenderer config={config} />   // type: "${type}", id: "${id}"`;
}

export function lessonSnippet(json: string): string {
  return `import { LessonPlayer, defineLesson } from "@nibblearn/react";
import "@nibblearn/react/styles.css";

const lesson = defineLesson(${json});

export function Course() {
  return <LessonPlayer lesson={lesson} onComplete={(c) => console.log(c)} />;
}`;
}

export const componentNames: Record<string, string> = {
  "story-cards": "StoryCards",
  flashcards: "Flashcards",
  "choice-challenge": "ChoiceChallenge",
  "true-false": "TrueFalse",
  "match-pairs": "MatchPairs",
  "sequence-builder": "SequenceBuilder",
  "category-sort": "CategorySort",
  "fill-blanks": "FillBlanks",
  "hotspot-explorer": "HotspotExplorer",
  "screenshot-walkthrough": "ScreenshotWalkthrough",
  "branching-scenario": "BranchingScenario",
  conversation: "Conversation",
  "process-explorer": "ProcessExplorer",
  "spot-the-mistake": "SpotTheMistake",
  "what-if-simulator": "WhatIfSimulator",
  "budget-allocator": "BudgetAllocator",
  estimate: "Estimate",
  "label-diagram": "LabelDiagram",
  "image-compare": "ImageCompare",
  "word-builder": "WordBuilder",
  "priority-matrix": "PriorityMatrix",
  "inbox-triage": "InboxTriage",
};

export function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
