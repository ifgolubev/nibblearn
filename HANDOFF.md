# Nibblearn — Handoff

Current state of the project and what is left. Setup, commands, rules and the module checklist are in **`CLAUDE.md`**. Read that first.

## Start a new session

```bash
export PATH=~/.local/bin:$PATH
cd <path-to-this-repo>
pnpm install
pnpm dev          # http://localhost:5173
pnpm storybook    # http://localhost:6006
```

Suggested first prompt for Claude Code: _"Read CLAUDE.md and HANDOFF.md, run the verification steps, then continue with the open tasks."_

## State (2026-11-09)

| Area      | State                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand     | **Nibblearn**, tagline "Tiny interactions. Real learning." Packages `@nibblearn/core`, `@nibblearn/react`.                                                                                                                                                                                                                                                                                                      |
| Modules   | **22**. Learn: story-cards, flashcards. Practice: choice-challenge, true-false, match-pairs, sequence-builder, category-sort, fill-blanks, word-builder, estimate, label-diagram, spot-the-mistake. Explore: hotspot-explorer, screenshot-walkthrough, process-explorer, image-compare. Decide: branching-scenario, conversation, priority-matrix, inbox-triage. Simulate: what-if-simulator, budget-allocator. |
| Player    | `LessonPlayer`: intro, transitions, progress, localStorage persistence + resume, scoring, points/streaks, review, completion.                                                                                                                                                                                                                                                                                   |
| Content   | Zod schemas, `defineLesson` / `validateLesson` / `defineModule` (type-narrowing), readable errors. Lesson JSON `schemaVersion: 1` is guarded by `packages/core/test/compat.test.ts` with frozen fixtures.                                                                                                                                                                                                       |
| Language  | English only. The Russian locale was removed. Consumers translate via `messages`.                                                                                                                                                                                                                                                                                                                               |
| Design    | Neutral, original theme. Zinc surfaces, accent `#3b5bdb`, amber highlight, near-black dark mode, Bricolage Grotesque display font in sentence case, pill buttons, tactile press.                                                                                                                                                                                                                                |
| Showcase  | Home, gallery (filter, search, "Try it"), 22 module pages, JSON playground, lesson playground, 4 example lessons, `/embed/:id`, `/docs/*`. Route-level code splitting, lazy shiki.                                                                                                                                                                                                                              |
| Storybook | 51 stories (modules + variants, player, primitives). Toolbar: theme, reduced motion.                                                                                                                                                                                                                                                                                                                            |
| Docs      | 11 guides in `docs/`, including an AI authoring guide with a ready-made prompt. README, CONTRIBUTING, SECURITY, CoC, CHANGELOG, LICENSE (MIT).                                                                                                                                                                                                                                                                  |
| CI/CD     | `.github/workflows/ci.yml` (lint, format, typecheck, test, build, check:package, showcase, storybook, e2e), `release.yml` (Changesets + npm OIDC provenance), `deploy-showcase.yml` (GitHub Pages), dependabot.                                                                                                                                                                                                 |
| Git       | Only the initial commit exists. All work is uncommitted in the working tree. Nothing pushed or published.                                                                                                                                                                                                                                                                                                       |

### Last verification (all green)

| Check                                                                              | Result                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| prettier, eslint, typecheck (all workspaces + e2e)                                 | clean                                            |
| Vitest                                                                             | 282 passed                                       |
| `pnpm build`, `check:package`                                                      | OK, publint + attw "All good!" for both packages |
| Playwright (desktop + mobile, incl. axe WCAG 2.2 AA and 320px checks)              | 198 passed, 46 skipped by design                 |
| Storybook smoke (render + axe)                                                     | 51/51                                            |
| Consumer smoke test (packed tarballs, SSR render of all 22 modules, hostile input) | OK                                               |

## History of decisions (short)

1. Built 15 modules, player, showcase, docs and OSS infra under the provisional name "LearnKit".
2. Renamed to Nibblearn. CSS prefix changed `lk-` → `nb-`. API renamed to `NibblearnProvider` / `useNibblearn` / `NibblearnEvent`.
3. Fixed issues found by axe and e2e:
   - contrast tokens;
   - label-in-name;
   - zero-specificity base reset (`:where(.nb-root)`);
   - `ModuleRenderer` no longer depends on a side effect.
4. Added 7 modules. Each matches a pattern already used in real tools: marketing-mix allocation, Brilliant-style estimation, H5P Drag and Drop, H5P Image Juxtaposition, the Duolingo word bank, the Eisenhower matrix and e-tray exercises. All schema changes are additive.
5. Tried a louder brand-inspired look, then replaced it with a neutral original theme. Don't go back to it.
6. Removed Russian. The project is English only.

## Security review (2026-11-10)

Done and covered by tests:

- Colour, font and image-URL fields in lesson JSON are validated (`cssColorSchema`, `fontFamilySchema`, `imageSrcSchema` in `packages/core/src/schema/common.ts`). `url()`/`var()` in colours and `javascript:`-style image URLs are rejected.
- Formula identifiers and string-keyed lookups (icons, colour tokens) use own-property checks.
- No `eval`, `innerHTML` or network calls in the library. No secrets or personal paths in the repo or the tarballs.
- GitHub Actions pinned to SHAs, CI read-only permissions. Embed page posts only to the referrer origin.
- Showcase and Storybook self-host fonts (no Google Fonts requests).
- `SECURITY.md` has the threat model and host responsibilities.
- Packed tarballs: all 22 modules render in SSR; hostile input is rejected or escaped.

Known and accepted: `pnpm audit` reports 2 moderate advisories in dev-only tooling (`minimatch` via eslint, `glob` via Storybook). `pnpm audit --prod` is clean.

## Maturity review (2026-11-11)

Checked the packed tarballs from a consumer's point of view and fixed what it found:

- **Tree-shaking.** Importing one module pulled in all 22 (registry created at import time). The registries are now `@__PURE__`. One module costs ~105 kB gzip on top of React; the player with everything ~182 kB. Numbers are in the README.
- **SSR hydration.** Six modules mismatched between server and client (random shuffle seeds, dnd-kit's global id counter). Shuffles now use `seedFromString(config.id, life.runId)` and every `DndContext` has a stable id. `packages/react/test/ssr.test.tsx` renders, re-renders and hydrates every demo in StrictMode.
- **React 18.** True/False passed a ref to a function component under `AnimatePresence mode="popLayout"`; it is now `forwardRef`. A `useLayoutEffect` SSR warning is gone. Verified by hydrating all modules on React 18.3 and 19.3 in a consumer Vite app. The repo's own unit tests run on React 19 only (two React copies in one workspace break Testing Library).
- **Types.** `new ModuleRegistry([...defaultRegistry.list(), customDef])` did not typecheck with a typed custom component. Fixed (`AnyModuleDefinition`) and covered by `registry.test.tsx`, which plays a lesson mixing custom and built-in modules.
- **New gates.** `pnpm test:coverage` (floors: lines 88, branches 75), `pnpm check:docs` (every `@nibblearn/*` import in docs exists; relative links resolve). Both run in CI.

Possible later optimisation: mark the Zod schemas pure (or move to `zod/mini`) so single-module consumers do not ship all 22 schemas.

## Open tasks

Ordered by priority. Items 1–2 need the user's decision or accounts.

1. **Commit.** Ask the user before committing (they have not asked yet). Suggested: branch `initial-release`, one commit, message ending with the attribution line from the session reminder.
2. **Release.** Full steps in `docs/release.md`:
   - The user creates the npm org `nibblearn`. If the name is taken, stop and offer `@learnzzle` / `@nimblearn`.
   - The user creates the GitHub repo. Update `repository` / `homepage` / `bugs` in the package.json files and `GITHUB_URL` in `apps/showcase/src/components/Layout.tsx` if the repo isn't `github.com/ifgolubev/nibblearn` (personal account `ifgolubev`; commits use its GitHub noreply address).
   - `pnpm changeset` (minor for both packages) → `pnpm version-packages`. Push, enable Pages, configure Trusted Publishing for `release.yml`. The first publish may be manual.
3. **Docs polish (optional).** Add screenshots to the README.
4. **Optional ideas.**
   - Speed-round mode for choice-challenge.
   - Video hotspots.
   - Per-target text hints in label-diagram for screen-reader users.
   - Keyboard drag in priority-matrix (tap-to-place already works).
