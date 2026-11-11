# Track completion events

Every interaction that matters is emitted as a `NibblearnEvent`. Nothing is collected by default: events reach only the handlers you pass as props.

## `NibblearnEvent`

```ts
interface NibblearnEvent {
  type: NibblearnEventType;
  timestamp: string; // ISO
  lessonId?: string; // set for lesson:* events and for module events inside a LessonPlayer
  moduleId?: string;
  moduleType?: string; // e.g. "flashcards"
  payload?: Record<string, unknown>; // JSON-serialisable, module-specific
}
```

## Event types

| Type              | Fired when                                                                                                    | Typical payload                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `lesson:start`    | Learner presses Start, or the player auto-starts with no saved progress. Also after Retry/Start over.         | —                                                           |
| `lesson:resume`   | Saved progress is continued.                                                                                  | `{ index }`                                                 |
| `lesson:navigate` | Next/Back changes the current module.                                                                         | `{ from, to }`                                              |
| `lesson:complete` | Finish lesson is pressed (once per run).                                                                      | `{ score, points, passed }`                                 |
| `lesson:reset`    | Retry lesson / Start over clears progress (followed by `lesson:start`).                                       | —                                                           |
| `module:start`    | A module mounts, and again after every reset.                                                                 | —                                                           |
| `module:interact` | Low-level interaction: flip, drag, open hotspot, pick an option, move a slider.                               | Module-specific, e.g. `{ action: "flip", cardIndex, side }` |
| `module:answer`   | A checkable answer is submitted (question checked, pair matched, statement rated, choice made in a scenario). | Module-specific, usually includes `correct`                 |
| `module:hint`     | A hint is revealed.                                                                                           | e.g. `{ questionIndex }`, `{ blankId }`                     |
| `module:complete` | The module reports its result (once per run).                                                                 | `{ score, correct, total, attempts }`                       |
| `module:reset`    | The learner retries from the completion card, or the `resetKey` prop changes.                                 | —                                                           |

Payload shapes are stable per module but intentionally untyped; treat them as analytics detail rather than contract.

## `ModuleResult`

Delivered through `onComplete`/`onModuleComplete` and stored in progress.

```ts
interface ModuleResult {
  moduleId: string;
  moduleType: string;
  status: "completed";
  score?: number; // 0–1; undefined when the module has no notion of correctness
  correct?: number; // correct items
  total?: number; // scorable items
  attempts: number;
  durationMs: number; // time from module start (or last reset) to completion
  details?: Record<string, unknown>; // module-specific, serialisable
  completedAt: string; // ISO
}
```

Which modules score:

| Scored (0–1)                                                                                                                                                                                                                                                                                                                                                                                               | Unscored (`score` undefined)                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| flashcards (first-pass mastery), choice-challenge, true-false, match-pairs, sequence-builder, category-sort, fill-blanks, screenshot-walkthrough, spot-the-mistake, branching-scenario (when `showScore`), conversation, story-cards (when cards contain checks), what-if-simulator (when a challenge is met: 1), budget-allocator (your KPI ÷ optimal KPI, or goal progress), estimate (average accuracy) | story-cards without checks, hotspot-explorer, process-explorer, what-if-simulator without a challenge |

## Where to listen

### Module level

```tsx
<Flashcards
  config={deck}
  onEvent={(e) => console.log(e.type, e.payload)}
  onComplete={(result) => saveScore(result)}
/>
```

### Provider level

`NibblearnProvider onEvent` receives events from every module and player beneath it, including events that a `LessonPlayer` forwards from its modules.

```tsx
<NibblearnProvider onEvent={analytics.track}>
  <Flashcards config={deck} />
  <LessonPlayer lesson={lesson} />
</NibblearnProvider>
```

A module-level `onEvent` and a provider-level `onEvent` both fire for the same event.

### Player level

```tsx
<LessonPlayer
  lesson={lesson}
  onEvent={(e) => analytics.track(e)}
  onModuleComplete={(r) => console.log(r.moduleId, r.score)}
  onComplete={(c) => {
    // c: LessonCompletion — score, points, passed, progress…
    if (c.passed) awardBadge(c.lessonId);
  }}
/>
```

Inside a player, module events carry `lessonId` as well as `moduleId`.

## Example: an analytics adapter

`@nibblearn/core` exports a minimal `AnalyticsAdapter` interface (`{ track: EventHandler }`). Implement it once and pass `track` anywhere an `onEvent` is accepted.

```ts
import type { AnalyticsAdapter, NibblearnEvent } from "@nibblearn/core";

// A hypothetical tracker with a `capture(name, props)` method.
declare const tracker: { capture(name: string, props: Record<string, unknown>): void };

export function createTrackerAdapter(userId: string): AnalyticsAdapter {
  const forwarded = new Set<NibblearnEvent["type"]>([
    "lesson:start",
    "lesson:resume",
    "lesson:complete",
    "module:complete",
    "module:hint",
  ]);

  return {
    track(event) {
      if (!forwarded.has(event.type)) return; // skip noisy interact/answer events
      tracker.capture(event.type.replace(":", "_"), {
        userId,
        lessonId: event.lessonId,
        moduleId: event.moduleId,
        moduleType: event.moduleType,
        at: event.timestamp,
        ...event.payload,
      });
    },
  };
}
```

```tsx
const adapter = useMemo(() => createTrackerAdapter(user.id), [user.id]);

<NibblearnProvider onEvent={adapter.track}>
  <LessonPlayer lesson={lesson} />
</NibblearnProvider>;
```

Keep the handler referentially stable (`useMemo`/`useCallback`): the provider's context value is recomputed when `onEvent` changes.

## Building events yourself

Custom modules get an `emit` function from `useModuleLifecycle` that fills in `moduleId`, `moduleType` and the timestamp. Outside React, `createEvent(type, data)` from `@nibblearn/core` builds a well-formed event object. See [Implement a custom module](./custom-modules.md).

## Nothing is collected by default

Nibblearn has no built-in analytics, no network access and no global listeners. If you do not pass `onEvent`, events are dropped. Progress persistence is separate and local; see [Save learner progress](./progress.md).
