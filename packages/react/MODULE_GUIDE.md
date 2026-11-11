# Module implementation guide

This guide is the contract every Nibblearn module follows. It is used both by the
core team and by anyone building a custom module.

## Files

```
packages/core/src/schema/modules/<type>.ts     # Zod schema + types  (already written for built-ins)
packages/core/src/logic/<name>.ts              # pure logic, unit-tested in packages/core/test
packages/react/src/modules/<type>/<Name>.tsx   # component (default + named export)
packages/react/src/modules/<type>/<type>.css   # scoped styles, class prefix `nb-<short>__`
packages/react/src/modules/<type>/<Name>.test.tsx
examples/src/modules/<type>.ts                 # realistic demo config: `export const <camel>Demo = {...} satisfies <Type>Input`
```

## Component contract

```tsx
export function MyModule({ config, onComplete, onEvent, resetKey, hideHeader, className }: ModuleProps<MyConfig>) { ... }
export default MyModule;
```

1. **Validate first.** Parse `config` with the schema (`schema.safeParse`) in a thin wrapper; render
   `<InvalidModule type="…" issues={…} />` on failure. Never crash on bad JSON. See `ChoiceChallenge.tsx`.
2. **One `ModuleShell`.** Render exactly one `<ModuleShell type id title instructions appearance announcement …>`.
   Pass `title={hideHeader ? undefined : config.title}`.
3. **Lifecycle.** `const life = useModuleLifecycle({ moduleId, moduleType, onComplete, onEvent, resetKey })`.
   - Keep all run state in an inner component keyed by the run: `<MyModuleBody key={life.runId} life={life} … />`.
     A reset (retry button or a new `resetKey`) remounts the body with fresh state. Do **not** reset state in
     `useEffect(..., [life.runId])` — `react-hooks/set-state-in-effect` flags it. See `CategorySort.tsx`,
     `BranchingScenario.tsx` or `FillBlanks.tsx` for the pattern.
   - Call `life.attempt()` on each check, `life.emit("module:interact" | "module:answer" | "module:hint", payload)`.
   - Call `life.complete({ score, correct, total, details })` exactly once when done (score 0–1; omit score when
     the module has no notion of correctness).
   - Reset/retry: `life.reset(); life.emit("module:reset")`.
4. **Completion state.** Show `<CompletionCard score=… stats=… onRetry=…>` (or a module-specific equivalent
   that still uses the shared classes) when finished.
5. **i18n.** All UI strings via `const { t } = useNibblearn()` and keys in `packages/core/src/i18n/en.ts`.
   Never hard-code English in JSX. Add keys only in your module's section if a needed key is missing.
6. **Safe text.** Render learner-facing strings with `<RichText text=… />` (supports **bold**, _italic_, `code`). Never `dangerouslySetInnerHTML`.
7. **Images.** Use `<SafeImage media=… />` (handles broken URLs).
8. **Accessibility.**
   - Fully operable with keyboard: every drag/swipe interaction has a button alternative.
   - Visible focus (inherited), `aria-pressed`/`aria-checked`/`role` where appropriate, `aria-live` via the
     `announcement` prop + `useAnnounce()`; announce correct/incorrect and completion.
   - No colour-only feedback: always pair colour with icon/text.
   - Touch targets ≥ 44px.
9. **Motion.** `motion/react` for transitions; always respect `useReducedMotion()` (`reduced ? false : {...}` for `initial`,
   zero durations). Keep animations short (≤ 360ms) and purposeful.
10. **Responsive.** Mobile-first CSS. Use container queries `@container nb (min-width: 640px)` for wider layouts.
    Never cause horizontal overflow at 320px.
11. **Styling.** Only `.nb-*` classes and `--nb-*` tokens from `src/styles/tokens.css`. No inline colours.
    Import the CSS file at the top of the component (`import "./<type>.css"`).
12. **Events.** The `details` object in the result and all event payloads must be JSON-serialisable.
13. **Tests** (Vitest + Testing Library, jsdom): render, complete successfully, incorrect path + retry, reset via
    `resetKey`, keyboard operation, invalid config → alert. Use `findBy*` / `waitFor` around animated transitions.
    Use `userEvent.setup()`.
14. **Demo content.** Original, fictional, marketing-agency flavoured, internally consistent numbers,
    polished copy. Demos live in `examples/src/modules/<type>.ts`.

## Server rendering

Modules must render on the server and hydrate without mismatches (Next.js, Remix, Astro):

- Render is deterministic: no `Math.random()`, `Date.now()` or `typeof window` branches during render.
- Shuffle with a seed from `seedFromString(config.id, life.runId)` (or the config's `shuffleSeed`).
- Give every dnd-kit `DndContext` a stable `id` (e.g. `` `${config.id}-dnd` ``); its default id is a global counter.
- Children of `AnimatePresence mode="popLayout"` must forward their ref (`forwardRef`), which React 18 requires.
- Use `useEffect` (or an isomorphic layout effect) rather than a bare `useLayoutEffect`.

`packages/react/test/ssr.test.tsx` checks all of this for every module's demo.

## Shared primitives (`src/primitives`)

`Button`, `Card`, `ProgressBar`, `StepDots`, `Feedback` / `AnimatedFeedback`, `RichText`, `SafeImage`, `Hint`,
`Explanation`, `LiveRegion`, `Badge`, `ModuleShell`, `InvalidModule`, `CompletionCard`, `OptionCard`.
Shared hooks (`src/hooks`): `useModuleLifecycle`, `useAnnounce`, `useReducedMotion`, `useMediaQuery`.

## Running

```
pnpm --filter @nibblearn/react test -- src/modules/<type>
pnpm --filter @nibblearn/react typecheck
pnpm --filter @nibblearn/examples typecheck
```
