# Releasing

How `@nibblearn/core` and `@nibblearn/react` are versioned, verified and published from the pnpm monorepo.

## Overview

| Step                         | Command / place                                                        |
| ---------------------------- | ---------------------------------------------------------------------- |
| Describe a change            | `pnpm changeset`                                                       |
| Bump versions and changelogs | `pnpm version-packages` (runs `changeset version`)                     |
| Build both packages          | `pnpm build`                                                           |
| Verify package exports       | `pnpm check:package` (publint + Are the Types Wrong)                   |
| Inspect the tarball          | `npm pack --dry-run` in each package                                   |
| Publish                      | `pnpm release` (`pnpm build && changeset publish`), normally run by CI |

Both packages are **linked** in `.changeset/config.json`, so they always receive the same version bump and `@nibblearn/react` depends on `@nibblearn/core` via `workspace:^` (rewritten to a real range at publish time). The showcase and examples workspaces are ignored by Changesets.

## 1. Versioning with Changesets

Every user-facing change lands with a changeset file:

```bash
pnpm changeset
# pick the packages, choose patch / minor / major, write a one-line summary
git add .changeset/*.md
git commit -m "feat(react): add poll module"
```

Guidelines:

- `patch` for fixes and docs, `minor` for new modules, props or schema fields (additive), `major` for schema-breaking changes (removing/renaming fields, changing `schemaVersion`).
- Summaries become the changelog (`@changesets/changelog-github` links the PR and author), so write them for users.
- Pure refactors and showcase-only changes do not need a changeset (`pnpm changeset --empty` if CI requires one).

To cut a release locally:

```bash
pnpm version-packages   # consumes changesets, bumps package.json + CHANGELOG.md
git commit -am "chore: version packages"
```

In CI the Changesets action opens a "Version Packages" pull request instead; merging it triggers publishing.

## 2. CI

The repository runs GitHub Actions from `.github/workflows/` (the workflows directory exists; add the files below if they are not yet present).

**`ci.yml`** on every push and pull request:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm check:package
pnpm build:showcase
pnpm test:e2e   # Playwright + axe against the built showcase
```

**`release.yml`** started manually (Actions → Release → Run workflow; it never runs on its own, because with no pending changesets it publishes):

1. Same install/build/test steps.
2. `changesets/action` with `version: pnpm version-packages` and `publish: pnpm release`.
3. If changesets are pending it opens/updates the Version Packages PR; if the PR was just merged it publishes to npm and creates git tags (`@nibblearn/core@x.y.z`, `@nibblearn/react@x.y.z`).

Minimal job permissions for trusted publishing:

```yaml
permissions:
  contents: write # tags, release PR
  pull-requests: write
  id-token: write # OIDC token for npm provenance
```

Node 20+ and the pnpm version pinned in `package.json` (`packageManager`) are required; use `pnpm/action-setup` and `actions/setup-node` with `cache: pnpm`.

## 3. Build and verify locally

```bash
pnpm install
pnpm build                       # vite lib build + tsc declarations for packages/*
pnpm check:package               # publint + attw --profile node16 in each package
cd packages/react && npm pack --dry-run
```

What to look for in `npm pack --dry-run`:

- Only `dist/`, `README.md`, `LICENSE` and `package.json` are included (the `files` field).
- `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` exist; for `@nibblearn/react` also `dist/styles.css`.
- Tarball size stays reasonable (no source maps of the showcase, no test files).
- `@nibblearn/react/package.json` shows `@nibblearn/core` with a real semver range, not `workspace:^` (pnpm rewrites it during `pnpm publish`/`changeset publish`; a raw `npm publish` from the package folder does **not**).

`check:package` fails on missing `exports` conditions, mismatched `types` resolution or CJS/ESM type drift; fix those before publishing.

Smoke-test the tarball in a fresh app:

```bash
cd packages/react && pnpm pack
mkdir /tmp/nb-smoke && cd /tmp/nb-smoke && npm init -y
npm install react react-dom ../path/to/nibblearn-react-0.1.0.tgz
node -e "import('@nibblearn/react').then(m => console.log(Object.keys(m).length))"
```

## 4. npm trusted publishing (OIDC)

Trusted publishing lets GitHub Actions publish without a long-lived npm token; npm verifies the workflow's OIDC identity and attaches a provenance attestation. Both packages already set `"publishConfig": { "access": "public", "provenance": true }`.

Setup on npmjs.com, per package:

1. Open the package page → **Settings** → **Publishing access** (or **Trusted publishers**).
2. Add a GitHub Actions publisher:
   - Organization/user: the GitHub owner of the repo.
   - Repository: the repo name.
   - Workflow filename: `release.yml` (must match the file in `.github/workflows/` exactly).
   - Environment: leave empty unless the job uses a GitHub environment.
3. Save. Repeat for the second package.
4. Optionally set "Require two-factor authentication or trusted publisher" so tokens cannot publish.

In the workflow:

- `permissions: id-token: write` on the publish job.
- Use `actions/setup-node` with `registry-url: https://registry.npmjs.org`.
- npm CLI 11.5+ (or Node 22+) performs OIDC exchange automatically; no `NPM_TOKEN` secret is needed. On older CLIs, `npm install -g npm@latest` before publishing.
- Do not add `NODE_AUTH_TOKEN` when using OIDC; a token takes precedence and disables provenance from trusted publishing.

Provenance shows up as a "Built and signed on GitHub Actions" badge on the npm page and can be verified with `npm audit signatures`.

### First-publish caveat

A trusted publisher can only be configured on a package that **already exists** on npm (or, for scoped packages, when the organisation allows it). The very first version of each package is therefore usually published manually:

```bash
# once, from a machine with npm login and 2FA
pnpm build && pnpm check:package
cd packages/core && pnpm publish --access public
cd ../react && pnpm publish --access public
```

Use `pnpm publish` (not `npm publish`) so the `workspace:^` dependency is rewritten. Publish `core` before `react`. After the packages exist, configure trusted publishing as above; every later release goes through `release.yml`.

If the organisation enforces "publishing requires 2FA", the manual publish will prompt for an OTP; granular access tokens with "bypass 2FA" are an alternative for a one-off bootstrap, but prefer the interactive path and never commit tokens.

## 5. GitHub release

After `changeset publish` pushes tags:

1. Go to **Releases** → **Draft a new release**.
2. Choose the `@nibblearn/react@x.y.z` tag (one release per version is enough; mention both packages).
3. Title `vX.Y.Z`; paste the relevant `CHANGELOG.md` sections from both packages.
4. Attach nothing; npm is the artifact source. Link the npm pages and the showcase deploy.
5. Publish. Mark pre-1.0 releases as "pre-release" if you want to signal API instability.

`changesets/action` can create the GitHub release automatically with `createGithubReleases: true`; enable it once the manual flow is comfortable.

## 6. Naming note

The packages are `@nibblearn/react` and `@nibblearn/core`. Availability checked on 2026-11-08:

- `@nibblearn/react`, `@nibblearn/core` and `nibblearn` are not published on npm.
- No npm organisation named `nibblearn` exists. Whether a _user_ named `nibblearn` exists can only be confirmed when signed in, so create the organisation first and stop if npm reports the name as taken.
- The GitHub name `nibblearn` and the domain `nibblearn.com` are free.
- Nearby brand: the microlearning app [Nibble](https://nibble-app.com/) (pending US trademark "NIBBLE: YOUR BITE OF KNOWLEDGE", class 9). Consider a trademark check by counsel before marketing heavily.

Re-check right before publishing:

```bash
npm view @nibblearn/react   # E404 = not published
npm view @nibblearn/core
curl -s -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/-/org/nibblearn/package   # 404 = no such org
curl -s -o /dev/null -w "%{http_code}\n" https://api.github.com/users/nibblearn             # 404 = free
```

Fallback scopes if `@nibblearn` is unavailable: `@learnzzle` or `@nimblearn` (both unused on npm and GitHub as of the check). Switching requires the owner's decision. Then update: both `package.json` `name` fields, the `@nibblearn/core` dependency in `packages/react/package.json`, `.changeset/config.json`, the `repository` / `homepage` / `bugs` URLs, docs and showcase imports — search for `@nibblearn/` across the repo.

## Checklist before every release

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green
- [ ] `pnpm build && pnpm check:package` green
- [ ] `npm pack --dry-run` shows only `dist`, README, LICENSE
- [ ] Changeset present and summary reads well
- [ ] Schema changes documented in [schema reference](./schema-reference.md) and, if breaking, `schemaVersion` bumped with a migration note
- [ ] Showcase deployed from the same commit
