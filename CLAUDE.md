# CLAUDE.md — Nibblearn

Instructions for Claude Code working in this repository. Read this first, then `HANDOFF.md` for the current state and open tasks.

## What this is

**Nibblearn** — "Tiny interactions. Real learning." An open-source React library of **22 interactive learning modules** plus a **Lesson Player** that plays lessons described as JSON. Packages: `@nibblearn/core` (schemas, validation, logic, i18n — no React) and `@nibblearn/react` (components, player, `styles.css`). A showcase site, Storybook, docs and four example lessons live in the same pnpm monorepo.

Status: release candidate. Nothing is committed beyond the initial commit, nothing is pushed or published. **Never commit, push, publish to npm or register accounts unless the user explicitly asks.**

## Environment setup

If pnpm is not on your PATH (for example it was installed as a corepack shim in `~/.local/bin`), add it in every shell before any pnpm command:

```bash
export PATH=~/.local/bin:$PATH
cd <path-to-this-repo>
pnpm install
```

On a fresh machine: Node ≥ 20 (22 recommended), `corepack enable --install-directory ~/.local/bin`, then `pnpm install`. Playwright browsers: `pnpm exec playwright install chromium`.

## Run it locally

```bash
pnpm dev               # showcase site → http://localhost:5173 (live-reloads library source)
pnpm storybook         # Storybook → http://localhost:6006
```

Start them with the Bash tool's `run_in_background: true`. Don't pass extra args through `pnpm storybook -- …` (they reach Storybook verbatim and break it). If you need flags, run `pnpm exec storybook dev -p 6006 --no-open --ci` inside `apps/storybook`.

## Verify (run all of these before saying work is done)

```bash
pnpm format:check                          # or: pnpm prettier --write .
pnpm lint
pnpm typecheck                             # all workspaces
pnpm exec tsc -p e2e/tsconfig.json --noEmit
pnpm test:coverage                         # Vitest + coverage floors (322 tests at last run; includes SSR/hydration test)
pnpm build                                 # packages → packages/*/dist
pnpm check:package                         # publint + attw, expect "All good!" ×2
pnpm check:docs                            # docs imports + links vs built packages
pnpm build:showcase                        # REQUIRED before e2e
pnpm test:e2e                              # Playwright desktop + mobile (198 passed / 46 skipped by design)
pnpm build:storybook
```

Last full run: everything green. 46 e2e skips are intentional (mobile-only vs desktop-only tests).

### Gotchas

- **e2e serves the built showcase** (`vite preview` on :4173, see `playwright.config.ts`, `reuseExistingServer`). After any source change: `pnpm build:showcase` first, or tests run against stale code. If :4173 is held by an old preview: `lsof -ti :4173 | xargs kill`.
- **Run a single react test file** with `pnpm --filter @nibblearn/react exec vitest run src/modules/<type>`. The `pnpm --filter … test -- <path>` form runs the whole suite.
- Don't run two `pnpm build` / `build:showcase` processes at once (declaration bundling races).
- Typecheck must pass **without** built `dist` (CI runs it before build); workspaces map `@nibblearn/*` to `src` via tsconfig `paths`.
- After editing demo content run `pnpm --filter @nibblearn/examples export:json` (writes `examples/json/`).

### QA scripts (need the matching server running)

```bash
node scripts/qa/axe-audit.mjs [paths…]           # axe on :4173; VW=412 for mobile width
node scripts/qa/overflow.mjs /modules/<type>      # horizontal-overflow finder; VW=320
TYPES=a,b THEME=dark VW=390 node scripts/qa/demo-shots.mjs <outDir>   # demo-frame screenshots
node scripts/qa/screenshots.mjs <outDir>          # full pages, desktop + mobile
SB=http://localhost:6007 node scripts/qa/storybook-smoke.mjs   # serve apps/storybook/storybook-static first
```

To point a script at the dev server instead of :4173, copy it with `sed 's#localhost:4173#localhost:5173#'`. Put screenshots in the scratchpad, not the repo. Always look at screenshots after visual changes.

## Repository map

```
packages/core/src/schema/modules/<type>.ts   Zod schema per module (+ registry.ts, lesson.ts union)
packages/core/src/logic/                     pure evaluation logic (unit-tested in packages/core/test)
packages/core/src/i18n/en.ts                 ALL UI strings (English only)
packages/core/test/compat.test.ts            JSON compatibility contract; fixtures/ are frozen
packages/react/src/modules/<type>/           Component.tsx + .css + .test.tsx per module
packages/react/src/player/                   LessonPlayer
packages/react/src/primitives/               Button, OptionCard, CompletionCard, ModuleShell, …
packages/react/src/styles/tokens.css         design tokens (--nb-*), light/dark/system
packages/react/src/defaultRegistry.ts        built-in module registration; ModuleRenderer.tsx
packages/react/MODULE_GUIDE.md               module contract — read before touching modules
examples/src/modules/, examples/src/lessons/ demo configs + 4 lessons (TS) → examples/json/
apps/showcase/                               site (Tailwind); lib/moduleDocs.ts, lib/demos.ts
apps/storybook/                              stories per module/player/primitives
docs/                                        user docs (rendered by the showcase /docs)
e2e/                                         Playwright specs; helpers.ts has MODULE_TYPES
```

## Hard rules

1. **JSON compatibility.** Lesson JSON is `schemaVersion: 1`. Changes must be additive: new module types or new optional fields only. Never change or remove existing fields or defaults. Never edit `packages/core/test/fixtures/*`. `compat.test.ts` must pass.
2. **English only.** UI strings go in `packages/core/src/i18n/en.ts`, never hard-coded in components. There is no other built-in locale. Do not add Russian or other languages; translations are the consumer's job via `messages`.
3. **Safety.** Lesson JSON is untrusted input (see `SECURITY.md`). Any new field that reaches a style or URL must use `cssColorSchema` / `fontFamilySchema` / `imageSrcSchema`. Look up content-provided keys with own-property checks. Never `eval`/`new Function` on lesson content (formulas use the parser in `logic/formula.ts`). Never `dangerouslySetInnerHTML` for content (use `RichText`). No analytics by default.
4. **Accessibility (WCAG 2.2 AA).** Keyboard path for every drag/swipe. Visible focus. Colour never the only signal. Accessible name must contain the visible text (prefer content-derived names + `nb-sr-only` extras over `aria-label`). Touch targets ≥ 24px with spacing (44px preferred). `prefers-reduced-motion` respected. The axe e2e spec covers every module page.
5. **Responsive.** No horizontal overflow at 320px. Use container queries `@container nb (min-width: …)`. The mobile e2e spec also checks for text clipped by `overflow: hidden`.
6. **Design system.** Styling only via `.nb-*` classes and `--nb-*` tokens. The theme is **neutral and original**. Do not copy any existing brand's look (an earlier draft used electric blue `#0009dc`, lime cards, navy and condensed uppercase headlines — don't bring that back).
   - Accent `#3b5bdb`, amber `--nb-highlight`, zinc surfaces, near-black dark theme.
   - Display font "Bricolage Grotesque", sentence case (`--nb-title-transform: none`).
   - Pill buttons, `scale(0.97)` press. Hover only inside `@media (hover: hover) and (pointer: fine)`. Never animate from `scale(0)`.
   - `--nb-lime*` are deprecated aliases of `--nb-highlight*`.
7. **SSR-safe rendering.** Render must be deterministic: no `Math.random()`, `Date.now()` or browser-only branches during render. Shuffle with `seedFromString(config.id, life.runId)`, give every `DndContext` a stable `id`, and use `forwardRef` for children of `AnimatePresence mode="popLayout"`. `packages/react/test/ssr.test.tsx` enforces this for every module.
8. **Module reset pattern.** `XInner` owns `useModuleLifecycle`; state lives in `<XRun key={life.runId} … />`. Never reset state in `useEffect` (lint rule `react-hooks/set-state-in-effect`).
9. Demo content is original and fictional: agency **Brightline Media**, clients Northwind Outdoor and Harbor Supply Co., tools "Pulse Analytics" and "Orbit CRM". Keep numbers consistent across demos and mark them illustrative.

## Adding a module (checklist)

Mirror an existing recent module (e.g. `estimate`, `inbox-triage`):

1. **core.** `schema/modules/<type>.ts` → export in `schema/modules/index.ts` → `builtInModuleDefinitions` (registry.ts) → `builtInModuleSchema` union (lesson.ts). Logic in `logic/` with tests in `packages/core/test/`.
2. **Strings.** `i18n/en.ts` keys under a module prefix.
3. **react.** `modules/<type>/<Name>.tsx|.css|.test.tsx` → `defaultRegistry.ts` → export from `src/index.ts`.
4. **Demo.** `examples/src/modules/<type>.ts` (`satisfies <Name>Input`) → `examples/src/modules/index.ts` → `export:json`.
5. **Showcase.** `apps/showcase/src/lib/moduleDocs.ts`, `demos.ts`, `code.ts`, and an icon in `components/Icon.tsx`.
6. **Storybook.** `apps/storybook/src/<Name>.stories.tsx`.
7. **e2e.** Add the type to `MODULE_TYPES` in `e2e/helpers.ts`, and add `e2e/<type>.spec.ts` with a full interaction. Counts in gallery and navigation specs are dynamic.
8. **Docs.** `docs/schema-reference.md` section, `docs/ai-content-generation.md` cheat sheet + prompt, README module table and count.

## Releasing (only when the user asks)

See `docs/release.md`.

- **Scope.** `@nibblearn` was checked on 2026-11-08: the npm org was absent and the GitHub name was free. Confirm the scope is free when creating the npm org.
- **Fallbacks.** `@learnzzle` and `@nimblearn`. Switching needs the user's decision.
- **Steps.** `pnpm changeset` → `pnpm version-packages` → create the GitHub repo → configure npm Trusted Publishing for `release.yml`. The first publish may be manual: `pnpm publish --access public`.
