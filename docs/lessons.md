# Build a multi-step lesson

A lesson is a JSON object: a few top-level settings plus an ordered `modules` array. `LessonPlayer` turns it into an intro screen, a sequence of activities with navigation, saved progress, scoring, gamification and a summary with review.

```tsx
import { LessonPlayer, defineLesson } from "@nibblearn/react";

const lesson = defineLesson({
  schemaVersion: 1,
  id: "metrics-101",
  title: "Media metrics in 10 minutes",
  description: "The eight numbers every account manager needs to read a campaign report.",
  objectives: ["Explain CPM, CPC, CTR and ROAS", "Pick the right KPI for a campaign goal"],
  language: "en",
  intro: { show: true, estimatedMinutes: 8 },
  completion: { rule: "score", threshold: 0.7 },
  gamification: { points: true, pointsPerModule: 100, celebration: true, streaks: true },
  modules: [
    { id: "intro", type: "story-cards", content: { cards: [{ title: "Why metrics", body: "…" }] } },
    {
      id: "deck",
      type: "flashcards",
      content: { cards: [{ front: "CPM", back: "Cost per 1,000 impressions" }] },
    },
    {
      id: "quiz",
      type: "choice-challenge",
      scoring: { weight: 2, passThreshold: 0.5 },
      content: {
        questions: [{ prompt: "…", options: [{ text: "A", correct: true }, { text: "B" }] }],
      },
    },
  ],
});

<LessonPlayer lesson={lesson} onComplete={(c) => console.log(c.passed, c.score)} />;
```

You can also pass raw JSON (`lesson={json}`): the player validates it at runtime and renders a readable error list if it is invalid.

## Lesson schema

| Field                          | Type                                | Default         | Description                                                                                 |
| ------------------------------ | ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| `schemaVersion`                | `1`                                 | required        | Must be the literal `1`.                                                                    |
| `id`                           | string                              | required        | Letters, numbers, `-`, `_`. Used as the progress storage key.                               |
| `title`                        | string (1–200)                      | required        | Shown on the intro and summary.                                                             |
| `description`                  | text                                | —               | Shown under the title. Supports inline markup.                                              |
| `objectives`                   | string[] (max 12)                   | `[]`            | "What you'll learn" list on the intro screen.                                               |
| `language`                     | string                              | `"en"`          | BCP-47 tag. Also the default UI locale of the player.                                       |
| `theme.mode`                   | `"light" \| "dark" \| "system"`     | `"system"`      | Player theme.                                                                               |
| `theme.accent`                 | CSS color                           | —               | Accent override for this lesson.                                                            |
| `theme.radius`                 | number (0–32)                       | —               | Base corner radius in px.                                                                   |
| `theme.fontFamily`             | string                              | —               | Font stack.                                                                                 |
| `completion.rule`              | `"all-modules" \| "score" \| "any"` | `"all-modules"` | When the lesson counts as passed (below).                                                   |
| `completion.threshold`         | number (0–1)                        | `0.7`           | Minimum lesson score for rule `"score"`.                                                    |
| `gamification.points`          | boolean                             | `true`          | Show points in the bar and summary.                                                         |
| `gamification.pointsPerModule` | integer                             | `100`           | Points for a fully correct module (scaled by score; unscored modules earn the full amount). |
| `gamification.celebration`     | boolean                             | `true`          | Confetti on a passed summary.                                                               |
| `gamification.streaks`         | boolean                             | `false`         | Flame counter for consecutive modules scored ≥ 0.7.                                         |
| `intro.show`                   | boolean                             | `true`          | Show the intro screen before the first module.                                              |
| `intro.image`                  | media                               | —               | Picture beside the intro copy.                                                              |
| `intro.estimatedMinutes`       | number (1–600)                      | —               | "About N min" badge.                                                                        |
| `intro.cta`                    | string (max 40)                     | —               | Label of the start button (default "Start lesson").                                         |
| `modules`                      | module[] (1–100)                    | required        | Any built-in or registered module configs. Ids must be unique.                              |
| `metadata`                     | record                              | `{}`            | Free-form: strings, numbers, booleans or string arrays. Ignored by Nibblearn.               |

Module fields are documented in the [schema reference](./schema-reference.md).

### Completion rules

| Rule          | Passed when                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `all-modules` | Every module has a result. The score is reported but does not gate completion.                                                       |
| `score`       | Every module is completed **and** the weighted lesson score is ≥ `threshold`. The summary shows a pass/fail ring with the threshold. |
| `any`         | The last module is completed. Useful for reading-only lessons.                                                                       |

The "Finish lesson" button is enabled only when the rule is satisfied on the last module (or in review mode).

## `LessonPlayer` props

| Prop               | Type                                     | Default                | Description                                                                                        |
| ------------------ | ---------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `lesson`           | `Lesson \| unknown`                      | required               | Output of `defineLesson` or raw JSON.                                                              |
| `registry`         | `ModuleRegistry`                         | `defaultRegistry`      | Resolves module types to components and schemas. Needed for [custom modules](./custom-modules.md). |
| `storage`          | `ProgressStorage \| false`               | `createLocalStorage()` | Where progress is saved. `false` disables persistence. See [Progress](./progress.md).              |
| `onEvent`          | `(event: NibblearnEvent) => void`        | —                      | Receives every lesson and module event. See [Events](./events.md).                                 |
| `onComplete`       | `(completion: LessonCompletion) => void` | —                      | Called once when the learner finishes.                                                             |
| `onModuleComplete` | `(result: ModuleResult) => void`         | —                      | Called each time a module completes.                                                               |
| `locale`           | string                                   | `lesson.language`      | UI locale (English built in; add languages via `messages`).                                        |
| `theme`            | `"light" \| "dark" \| "system"`          | `lesson.theme.mode`    | Theme override.                                                                                    |
| `framed`           | boolean                                  | `true`                 | Bordered, elevated card around the player. Set `false` to blend into your layout.                  |
| `autoStart`        | boolean                                  | `false`                | Skip the intro screen and start (or resume) immediately.                                           |
| `header`           | ReactNode                                | —                      | Slot rendered above the progress bar, e.g. a close button in a modal.                              |
| `className`        | string                                   | —                      | Extra class on the root element.                                                                   |

`LessonCompletion` extends `LessonScore` with `lessonId` and the final `progress` object:

```ts
interface LessonCompletion {
  lessonId: string;
  progress: LessonProgress;
  score: number; // weighted average of scored modules, 0–1
  scoredModules: number;
  completedModules: number;
  totalModules: number;
  points: number;
  maxPoints: number;
  passed: boolean;
}
```

## Scoring

Each module reports a `ModuleResult` with an optional `score` (0–1). Modules without a notion of correctness (story cards without checks, hotspot and process explorers, a simulator without a challenge) complete without a score and are excluded from the average.

`computeLessonScore(lesson, results)` from `@nibblearn/core` is what the player uses:

- `score` is the weighted mean of scored modules, using each module's `scoring.weight` (default 1).
- `points` adds `round(score × pointsPerModule)` per scored module and the full `pointsPerModule` for unscored completed modules.
- `maxPoints` is `pointsPerModule × modules.length`.
- `passed` follows the completion rule above.

```ts
import { computeLessonScore } from "@nibblearn/core";

const s = computeLessonScore(lesson, progress.results);
// { score: 0.83, scoredModules: 2, completedModules: 3, totalModules: 3, points: 266, maxPoints: 300, passed: true }
```

`scoring.passThreshold` on a module sets the score that counts as a pass for that module. When it is `0` (the default) the player uses `0.7`. It drives the pass/fail icons in the summary and the streak counter; the helpers `modulePassThreshold()` and `moduleResultPassed()` are exported from `@nibblearn/core` for your own reporting. The lesson-level gate remains `completion.threshold` (with `rule: "score"`).

## Review mode

After finishing, the summary lists every module with its status and score. Selecting one opens it in **review mode**: a banner with "Back to summary" appears, navigation is unlocked (Next and Back work even for incomplete modules), and the completed module shows its completion card. Reviewing does not change saved results.

## Retry

- **Retry lesson** on the summary clears stored progress, emits `lesson:reset`, then `lesson:start`, and restarts from the first module with fresh module state.
- **Per-module retry** is controlled by each module's `behavior.allowRetry` (and `maxAttempts` where supported). Retrying inside a module before completion does not touch lesson progress; the result is recorded once, when the module completes.
- **Start over** on the intro screen (shown when saved progress exists) does the same as Retry lesson.

## Resume

When `storage` finds unfinished progress for `lesson.id`, the intro shows "Resume where you left off" with the activity number and a Continue button. With `autoStart` or `intro.show: false`, the player resumes silently. Completed lessons open directly on the summary. Details are in [Save learner progress](./progress.md).
