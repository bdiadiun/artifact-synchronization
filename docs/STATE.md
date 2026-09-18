# Project state journal

Read this first in every new session, after `CLAUDE.md`. Keep it short: it is a resume point,
not a log. Update it in every PR (same commit as the work it describes).

## Where we are

| Field          | Value                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Current slice  | 29 `refactor: i18n naming` (branch `refactor/i18n-naming`, node F-35)                                                      |
| Gate           | 2 — rename done, canon path updated with the author's approval; awaiting result approval                                   |
| Last merged PR | #33 `docs: close F-19`; every mandatory requirement and all six bonus tasks are implemented; only the video (F-13) is left |
| Next slice     | none planned; only the video (F-13, author) is left                                                                        |

## Open decisions (see CANON.md → Decisions)

- None. A-1..A-11 are approved (2026-09-16); see `docs/decisions/`. Fork: https://github.com/bdiadiun/Viewers.

## Facts worth not rediscovering

- OHIF `master` needs Node >= 24 + pnpm 11; release `v3.12.17` needs Node >= 18 + yarn 1 → A-6, we base on `v3.12.17`.
- Local toolchain: Node 22.13.1, npm 10.9.2; yarn/pnpm not installed (use corepack for yarn 1 in the fork).
- `gh pr merge` is sometimes refused by the permission classifier ("Merge Without Review"); a retry from a fresh git-operator run after green CI has succeeded. Never work around a refusal.
- The `gh` token has the `workflow` scope since 2026-09-17 (needed to push `.github/workflows`).
- Git pushes over HTTPS use `gh auth setup-git` as the credential helper.
- GitHub default branch was the first pushed branch (`docs/canon-and-feature-graph`) until 2026-09-16; now `main`. A plain `git clone` therefore works.
- OHIF facts (measurement shape, events, tool activation) are in `docs/notes/ohif-bridge-api.md`; do not re-research.
- corepack 0.30 is available; yarn 1 for the fork comes from corepack, no global install.
- Viewer dev server: `OHIF_OPEN=false yarn --cwd platform/app dev` inside `viewer/` (root `yarn dev` picks up `bun.lock` and fails; without `OHIF_OPEN=false` webpack opens a browser tab on the user's machine on every start).
- Fork branches: `scoring` (base, from v3.12.17), feature branches PR into it; fork PR #1 = bridge extension.
- Study `1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1` has pixel spacing → areas arrive in mm² (verified with a headless ellipse).
- Raw OHIF `areaUnit` on the demo study is `mm²` (U+00B2); the bridge normalises the first token to `mm2`/`px2`. The default display set is a CT topogram with large pixel spacing, so areas are in the hundreds of thousands of mm² (real, not a bug).
- `cachedStats` is filled in cornerstone's render pass; with an instantaneous synthetic release the area in `MEASUREMENT_ADDED` can lag one frame. Human drags are fine; the S-5.1 UPDATED slice would correct it anyway.
- `VIEWER_READY` is sent on the first `toolGroupService` VIEWPORT_ADDED, not in preRegistration (setToolActive is a silent no-op before a viewport exists).

## Contract duplication

- The contract lives twice on purpose (A-12): the fork must build standalone. `npm run check:contract` compares the two files and the committed hash, `npm run contract:sync` performs the copy, and the fork's own workflow verifies its copy against `messages.sha256`.

## Facts added in slice 14

- A warm `node_modules` hid a broken dependency layout: after `npm ci`, Vitest could not find jsdom and ESLint could not resolve React types for Testing Library. Shared test tooling and React types now live in the root `package.json` (CONVENTIONS §1). Always verify with `npm ci` before gate 2.

## Follow-ups (out of current scope)

- Optional, not scheduled: unit tests for the extension's `throttle.ts` and `toMetrics`; bonus S-5.4 Length (F-17); bonus S-5.6 state restore (F-19).

- The fork's own ESLint crashes at v3.12.17 (legacy config + `@typescript-eslint` 5 under ESLint 9); we lint the extension with `npm run lint:fork` instead.

- OHIF "clear all measurements" emits `MEASUREMENTS_CLEARED`, not per-uid `MEASUREMENT_REMOVED`; rows would keep stale values. Small follow-up in the bridge if needed.

- Fork `tsc --noEmit` has two pre-existing type errors unrelated to runtime (`ToolGroupService` type lacks pubsub members used by `subscribe`; generated `pluginImports.js` cannot resolve the extension). Webpack/babel build is unaffected. Candidate for a small fork PR.

## Docs page

- `npm run docs:build` regenerates `docs/site/index.html` (commit it with the docs it bundles). The same page is published as a private artifact for the author; republish it after each merge.

## Comment ratio

- After slice 16: 227 comment lines vs 3 499 code lines (6%); rules in CONVENTIONS §8.

## Comment baseline before slice 16

- 937 comment lines vs 3 499 code lines (21%); worst: `focus.ts` 57%, `getCustomizationModule.tsx` 52%, `removals.ts` 48%, `ui-strings.ts` 45%, `bridge.ts` 41%.

## Lint status

- Slice 13 brought the baseline of 204 ESLint findings and 43 unformatted files to zero. `npm run lint`, `npm run lint:fork` and `npm run format:check` are green on `main` from here on.

## Session checklist

1. Read `CLAUDE.md`, this file, then the nodes of `docs/feature-graph.json` for the current slice.
2. Run `npm run check:graph`.
3. Continue from "Gate" above. Do not re-derive decisions already in `docs/decisions/`.
