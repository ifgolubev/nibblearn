# Contributing to Nibblearn

Thanks for your interest in Nibblearn! This guide explains how the repository is organised and how to propose changes.

## Prerequisites

- Node.js 20 or newer (22 recommended)
- pnpm 10 (`corepack enable` will install the pinned version)

## Getting started

```bash
git clone https://github.com/ifgolubev/nibblearn.git
cd nibblearn
pnpm install
pnpm dev            # showcase site at http://localhost:5173
```

Useful commands:

| Command                     | What it does                                           |
| --------------------------- | ------------------------------------------------------ |
| `pnpm dev`                  | Run the showcase site with live reload of the packages |
| `pnpm test`                 | Unit + component tests (Vitest)                        |
| `pnpm test:e2e`             | Playwright end-to-end and accessibility tests          |
| `pnpm typecheck`            | TypeScript across all packages                         |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                      |
| `pnpm build`                | Build `@nibblearn/core` and `@nibblearn/react`         |
| `pnpm build:showcase`       | Build the static showcase site                         |
| `pnpm storybook`            | Storybook with every module, the player and primitives |
| `pnpm check:package`        | publint + Are The Types Wrong on the built packages    |

## Repository layout

```
packages/core     # schemas, validation, evaluation logic, storage, i18n (no React)
packages/react    # components, 22 modules, LessonPlayer, styles.css
apps/showcase     # website: gallery, module pages, playground, examples, docs
apps/storybook    # isolated stories (theme / locale / reduced-motion toolbar, a11y addon)
examples          # example module configs and complete lessons (+ JSON export)
docs              # documentation rendered by the showcase and on GitHub
e2e               # Playwright tests
```

## Making changes

1. Create a branch from `main`.
2. Make your change with tests. Modules follow the contract in [`packages/react/MODULE_GUIDE.md`](./packages/react/MODULE_GUIDE.md).
3. Run `pnpm lint && pnpm typecheck && pnpm test`.
4. If the change affects a published package, add a changeset: `pnpm changeset` (choose `patch`/`minor`/`major` and write a short user-facing note).
5. Open a pull request using the template. Screenshots or recordings are very welcome for UI changes.

## Adding a module

- Schema in `packages/core/src/schema/modules/<type>.ts`, registered in `schema/modules/index.ts`, `schema/registry.ts` and `schema/lesson.ts`.
- Pure logic (if any) in `packages/core/src/logic/` with unit tests in `packages/core/test/`.
- Component, CSS and tests in `packages/react/src/modules/<type>/`, registered in `packages/react/src/defaultRegistry.ts` and exported from `src/index.ts`.
- UI strings in `packages/core/src/i18n/en.ts` (never hard-coded in components).
- Demo content in `examples/src/modules/<type>.ts` and docs metadata in `apps/showcase/src/lib/moduleDocs.ts`.

## Design principles

- Interaction first. Every module must be something to _do_.
- Accessible by default: keyboard alternatives for drag/swipe, live announcements, visible focus, reduced motion.
- One design system: only `--nb-*` tokens and `.nb-*` classes; no inline colours.
- Content is JSON: anything a learner sees must be configurable and validated.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
