# Implement a custom module

A module is a Zod schema plus a React component, registered under a `type` string. Once registered, it works everywhere a built-in module does: `ModuleRenderer`, `LessonPlayer`, `validateLesson`, events and progress.

This page builds a complete **poll** module: the learner picks one option, sees how "others" voted, and the module completes without a score.

## 1. Define the schema

Spread `moduleBaseShape` so the module gets the shared fields (`id`, `title`, `instructions`, `feedback`, `scoring`, `appearance`, `meta`), then add `type`, `content` and `behavior`.

```ts
// poll/schema.ts
import { z } from "zod";
import { idSchema, moduleBaseShape, textSchema } from "@nibblearn/core";

export const pollSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("poll"),
  content: z.object({
    question: textSchema,
    options: z
      .array(
        z.object({
          id: idSchema.optional(),
          text: textSchema,
          /** Illustrative share of previous voters, 0–100. */
          share: z.number().min(0).max(100).default(0),
        }),
      )
      .min(2)
      .max(6),
    /** Shown after voting. */
    explanation: textSchema.optional(),
  }),
  behavior: z
    .object({
      showResults: z.boolean().default(true),
      submitLabel: z.string().max(24).default("Vote"),
    })
    .default({ showResults: true, submitLabel: "Vote" }),
});

export type PollConfig = z.infer<typeof pollSchema>;
export type PollInput = z.input<typeof pollSchema>;
```

Conventions worth copying from the built-ins: ids are optional on list items (fall back to the index), text fields use `textSchema` (safe inline markup, 4,000 chars), every behaviour flag has a default, and cross-references are checked in `.superRefine()` so authors get a message with a path.

## 2. Build the component

```tsx
// poll/Poll.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  CompletionCard,
  Explanation,
  InvalidModule,
  ModuleShell,
  OptionCard,
  RichText,
  useAnnounce,
  useNibblearn,
  useModuleLifecycle,
  type ModuleProps,
} from "@nibblearn/react";
import { pollSchema, type PollConfig } from "./schema";
import "./poll.css";

export type PollProps = ModuleProps<PollConfig>;

/** Thin wrapper: validate, then render. Never crash on bad JSON. */
export function Poll({ config, ...rest }: PollProps) {
  const parsed = useMemo(() => pollSchema.safeParse(config), [config]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="poll"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return <PollInner config={parsed.data} {...rest} />;
}

function PollInner({ config, onComplete, onEvent, resetKey, hideHeader, className }: PollProps) {
  const { t } = useNibblearn();
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "poll",
    onComplete,
    onEvent,
    resetKey,
  });
  const { message, announce } = useAnnounce();
  const options = useMemo(
    () => config.content.options.map((o, i) => ({ ...o, id: o.id ?? `opt-${i}` })),
    [config.content.options],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  // Reset local state whenever the lifecycle restarts (resetKey or life.reset()).
  useEffect(() => {
    setSelected(null);
    setVoted(false);
  }, [life.runId]);

  const choose = (id: string) => {
    if (voted) return;
    setSelected(id);
    life.emit("module:interact", { optionId: id });
  };

  const vote = () => {
    if (!selected || voted) return;
    life.attempt();
    setVoted(true);
    life.emit("module:answer", { optionId: selected });
    announce(t("common.completed"));
    life.complete({ details: { optionId: selected } }); // no score: polls have no right answer
  };

  const retry = () => {
    life.reset();
    life.emit("module:reset");
  };

  return (
    <ModuleShell
      type="poll"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      announcement={message}
      className={className}
    >
      <p className="nb-poll__question">
        <RichText text={config.content.question} />
      </p>

      <div className="nb-poll__options" role="radiogroup" aria-label={config.content.question}>
        {options.map((o) => (
          <OptionCard
            key={o.id}
            text={o.text}
            state={selected === o.id ? "selected" : "idle"}
            disabled={voted}
            onClick={() => choose(o.id)}
          >
            {voted && config.behavior.showResults && (
              <span className="nb-poll__share">{o.share}%</span>
            )}
          </OptionCard>
        ))}
      </div>

      {!voted ? (
        <Button variant="primary" disabled={!selected} onClick={vote}>
          {config.behavior.submitLabel}
        </Button>
      ) : (
        <CompletionCard
          text={config.feedback.complete}
          onRetry={retry}
          retryLabel={t("common.retry")}
        >
          <Explanation text={config.content.explanation} />
        </CompletionCard>
      )}
    </ModuleShell>
  );
}

export default Poll;
```

```css
/* poll/poll.css — only .nb-* classes and --nb-* tokens */
.nb-poll__question {
  font-size: var(--nb-text-lg);
  font-weight: var(--nb-weight-semibold);
  margin-bottom: var(--nb-space-4);
}
.nb-poll__options {
  display: grid;
  gap: var(--nb-space-2);
  margin-bottom: var(--nb-space-4);
}
.nb-poll__share {
  margin-left: auto;
  color: var(--nb-fg-muted);
  font-variant-numeric: tabular-nums;
}
```

### The pieces

| API                       | Role                                                                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ModuleProps<Config>`     | `config`, `onComplete`, `onEvent`, `resetKey`, `hideHeader`, `className`. Every module component accepts exactly these.                                                                                                                                                                                         |
| `useModuleLifecycle(...)` | Emits `module:start` on mount and after each reset; `emit(type, payload)` scopes events to the module; `attempt()` counts checks; `complete({ score, correct, total, details })` builds the `ModuleResult` (with `attempts`, `durationMs`, `completedAt`) and calls `onComplete` once; `reset()` bumps `runId`. |
| `ModuleShell`             | The single root frame: themed `.nb-root`, header (title/instructions), body, optional `footer`, `eyebrow`, `aside`, `width`, and a polite live region fed by `announcement`.                                                                                                                                    |
| `useAnnounce()`           | `{ message, announce }` for screen-reader announcements; pass `message` to the shell.                                                                                                                                                                                                                           |
| `useNibblearn()`          | `t` (translator), `locale`, `theme`, `reducedMotion`.                                                                                                                                                                                                                                                           |
| Primitives                | `Button`, `Card`, `OptionCard`, `Feedback`, `Hint`, `Explanation`, `CompletionCard`, `ProgressBar`, `Badge`, `RichText`, `SafeImage`, `LiveRegion`, `InvalidModule`.                                                                                                                                            |
| `useReducedMotion()`      | Gate animations: `initial={reduced ? false : {...}}`.                                                                                                                                                                                                                                                           |

### i18n in custom modules

Reuse built-in keys where they fit (`common.submit`, `common.retry`, `common.completed`, `a11y.moduleComplete`). For strings of your own, pick a namespaced key and pass translations through the provider's `messages` prop; `t()` accepts any string key and falls back to the key itself when no translation exists:

```tsx
<NibblearnProvider locale="de" messages={{ "poll.vote": "Abstimmen" }}>
  …
</NibblearnProvider>;

// inside the module
const { t } = useNibblearn();
t("poll.vote"); // "Abstimmen" (or "poll.vote" if not provided)
```

Labels that belong to the content itself are still best kept in the config (`behavior.submitLabel` above) so authors localise them with the lesson.

## 3. Register the module

```ts
// poll/index.ts
import { ModuleRegistry, defaultRegistry, type ModuleDefinition } from "@nibblearn/react";
import { pollSchema } from "./schema";
import { Poll } from "./Poll";

export const pollDefinition: ModuleDefinition<typeof pollSchema> = {
  type: "poll",
  name: "Poll",
  description: "One question, one vote, see how others answered.",
  category: "practice", // "learn" | "practice" | "explore" | "decide" | "simulate"
  schema: pollSchema,
  component: Poll,
};

// Option 1: a new registry (recommended; no global mutation)
export const registry = new ModuleRegistry([...defaultRegistry.list(), pollDefinition]);

// Option 2: extend the shared default registry (affects every ModuleRenderer without a registry prop)
// defaultRegistry.register(pollDefinition);
```

Use it:

```tsx
<ModuleRenderer config={pollJson} registry={registry} />
<LessonPlayer lesson={lessonJson} registry={registry} />
```

## 4. Validate lessons that contain custom modules

`validateLesson` and `defineLesson` default to the built-in schemas; pass your registry's `SchemaRegistry` to accept the new type:

```ts
import { validateLesson, defineLesson } from "@nibblearn/core";

const res = validateLesson(json, { registry: registry.schemas });
if (!res.success) console.error(res.issues); // [{ path: "modules[2].content.options", message: "…" }]

const lesson = defineLesson(json, { registry: registry.schemas }); // throws LessonValidationError
```

`LessonPlayer` does this automatically with the `registry` prop. An unknown type produces a clear issue: `modules[2].type: unknown module type "pol". Known types: story-cards, flashcards, …, poll`.

For non-React validation (a Node script or API route), build a `SchemaRegistry` directly from `@nibblearn/core`:

```ts
import { SchemaRegistry, builtInModuleDefinitions } from "@nibblearn/core";
const schemas = new SchemaRegistry([
  ...builtInModuleDefinitions,
  { type: "poll", name: "Poll", description: "…", category: "practice", schema: pollSchema },
]);
```

## 5. Lazy loading

Replace `component` with `load` to code-split a heavy module. The registry wraps it in `React.lazy`; `ModuleRenderer`'s `fallback` prop (and the player) render while it loads.

```ts
export const pollDefinition: ModuleDefinition<typeof pollSchema> = {
  type: "poll",
  name: "Poll",
  description: "…",
  category: "practice",
  schema: pollSchema,
  load: () => import("./Poll"), // module must have a default export
};
```

```tsx
<ModuleRenderer config={pollJson} registry={registry} fallback={<p>Loading…</p>} />
```

The schema stays eagerly imported so validation never waits on the component chunk.

## Conventions summary (from MODULE_GUIDE)

1. **Validate first**: `schema.safeParse(config)` in a thin wrapper; render `InvalidModule` on failure.
2. **One `ModuleShell`** per module; pass `title={hideHeader ? undefined : config.title}`.
3. **Lifecycle**: `useModuleLifecycle`; reset local state on `life.runId`; `attempt()` per check; `emit("module:interact" | "module:answer" | "module:hint", payload)`; `complete()` exactly once with `score` 0–1 (omit when there is no correctness); retry = `life.reset(); life.emit("module:reset")`.
4. **Completion state**: `CompletionCard` (score ring, stats, retry).
5. **i18n**: all UI strings through `t()`; never hard-code English in JSX.
6. **Safe text**: `RichText` for learner-facing strings; never `dangerouslySetInnerHTML`.
7. **Images**: `SafeImage` (handles broken URLs, alt text).
8. **Accessibility**: full keyboard operation, a button alternative for every drag/swipe, visible focus, `aria-pressed`/`aria-checked`/roles, live announcements for correct/incorrect/complete, no colour-only feedback, touch targets ≥ 44px.
9. **Motion**: `motion/react`, always gated by `useReducedMotion()`, ≤ 360ms.
10. **Responsive**: mobile-first, container queries `@container nb (min-width: 640px)`, no horizontal overflow at 320px.
11. **Styling**: only `.nb-*` classes and `--nb-*` tokens; import the module CSS at the top of the component.
12. **Events**: `details` and payloads must be JSON-serialisable.
13. **Tests**: render, complete, incorrect + retry, reset via `resetKey`, keyboard, invalid config shows alert.
14. **Demo content**: original and internally consistent.

See [Accessibility](./accessibility.md) and [Theming](./theming.md) for the details behind items 8–11.
