# @nibblearn/react

**Tiny interactions. Real learning.**

Beautiful, accessible, interactive learning modules for React — flashcards, matching, branching scenarios, simulations and more — driven by JSON or components.

```bash
npm install @nibblearn/react
```

```tsx
import { LessonPlayer, defineLesson } from "@nibblearn/react";
import "@nibblearn/react/styles.css";

const lesson = defineLesson({
  schemaVersion: 1,
  id: "intro",
  title: "My first lesson",
  modules: [
    {
      id: "deck",
      type: "flashcards",
      content: { cards: [{ front: "CTR", back: "Click-through rate" }] },
    },
  ],
});

export const App = () => <LessonPlayer lesson={lesson} />;
```

- 22 modules: `StoryCards`, `Flashcards`, `ChoiceChallenge`, `TrueFalse`, `MatchPairs`, `SequenceBuilder`, `CategorySort`, `FillBlanks`, `WordBuilder`, `Estimate`, `LabelDiagram`, `SpotTheMistake`, `HotspotExplorer`, `ScreenshotWalkthrough`, `ProcessExplorer`, `ImageCompare`, `BranchingScenario`, `Conversation`, `PriorityMatrix`, `InboxTriage`, `WhatIfSimulator`, `BudgetAllocator`
- `LessonPlayer`, `NibblearnProvider`, `ModuleRenderer`, `ModuleRegistry` for custom modules
- Light/dark themes via CSS variables; English UI strings built in, translatable via `messages`
- React 18 and 19, ESM + CJS, SSR-safe, TypeScript declarations

Full documentation: https://github.com/ifgolubev/nibblearn#readme — MIT licensed.
