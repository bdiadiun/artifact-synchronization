# Project state journal

Read this first in every new session, after `CLAUDE.md`. Keep it short: it is a resume point,
not a log. Update it in every PR (same commit as the work it describes).

## Where we are

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current slice  | 61 `refactor: boundaries as schemas` (branch `refactor/boundaries-as-schemas`, nodes F-66 + F-67, decisions A-26..A-34), one PR of green commits per group superseding #78                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Gate           | between 1 and 2 — the React-bridge step (A-32), the review fixes (A-33) and the author's mirror design (A-34: `useChannel` in the channel package, `channel.on` / `ohif.on`, actions = contract commands) are in the working tree, uncommitted: lint, typecheck and check:graph green on the sources; the tests that named the removed API (`createChannel`, `onMessage`, `dispose`, `subscribeMeasurements`, `ARM_ROW`, the `uuid` envelope) are red until the tester rewrites them — the author asked to hold the tester until the code settles; then the browser scenario on the linked tree; versions raised once for the PR (contract 0.0.14, channel 0.0.8, bridge 0.0.10, adapter 0.0.9)                                                                      |
| Last merged PR | #77 `chore: pin the fork at the adapter release` (slice 59 closed: contract 0.0.13, channel 0.0.7, bridge 0.0.9, adapter 0.0.8, fork at ac786c8a)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Next slice     | after the merge: release runs, then the fork pin; 62 `refactor: name the packages after their roles` — `packages/viewer-bridge` → `packages/scoring-viewer` (`@bdiadiun/ohif-extension-scoring-viewer`; `ScoringViewer.tsx`, `useScoringViewer`, `ScoringViewerContext`, `bridge.ts` → `session.ts`), `packages/viewer-adapter` → `packages/ohif-extension-loader` (`@bdiadiun/ohif-extension-loader`), with the extension ids, `scripts/viewer.mjs`, the publish workflows, the graph, the notes (`bridge-internals.md`, `ohif-bridge-api.md`) and every document; new names publish on merge, then a fork PR switches the loader dependency and `pluginConfig.json` (decided 2026-09-23); then 63 `test: only the tests the assignment asks for`; the video (F-13) |

## Open decisions (see CANON.md → Decisions)

- None. A-1..A-11 are approved (2026-09-16); see `docs/decisions/`. Fork: https://github.com/bdiadiun/Viewers.

## Facts worth not rediscovering

- OHIF `master` needs Node >= 24 + pnpm 11; release `v3.12.17` needs Node >= 18 + yarn 1 → A-6, we base on `v3.12.17`.
- Local toolchain: Node 22.13.1, npm 10.9.2; yarn/pnpm not installed (use corepack for yarn 1 in the fork).
- `gh pr merge` is refused by the permission classifier ("Merge Without Review") — consistently since 2026-09-22, in both repositories. The git operator stops at the open, green PR and the author merges it. Never work around a refusal.
- The `gh` token has the `workflow` scope since 2026-09-17 (needed to push `.github/workflows`).
- Git pushes over HTTPS use `gh auth setup-git` as the credential helper.
- GitHub default branch was the first pushed branch (`docs/canon-and-feature-graph`) until 2026-09-16; now `main`. A plain `git clone` therefore works.
- OHIF facts (measurement shape, events, tool activation) are in `docs/notes/ohif-bridge-api.md`; do not re-research.
- corepack 0.30 is available; yarn 1 for the fork comes from corepack, no global install.
- Browser runs use `npm run viewer:link` (symlinks the four packages into the fork; `viewer:unlink` restores). It links nothing else: the fork's webpack resolves `react` from its own `node_modules` for a symlinked package (A-32, amended), and a `react` symlink under `packages/*/node_modules` would make the host application load two Reacts. Publish and pin only after the scenario passed on the linked tree.
- Viewer dev server: `OHIF_OPEN=false yarn --cwd platform/app dev` inside `viewer/` (root `yarn dev` picks up `bun.lock` and fails; without `OHIF_OPEN=false` webpack opens a browser tab on the user's machine on every start).
- Fork branches: `scoring` (base, from v3.12.17), feature branches PR into it; fork PR #1 = bridge extension.
- Study `1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1` has pixel spacing → areas arrive in mm² (verified with a headless ellipse).
- Raw OHIF `areaUnit` on the demo study is `mm²` (U+00B2); the bridge normalises the first token to `mm2`/`px2`. The default display set is a CT topogram with large pixel spacing, so areas are in the hundreds of thousands of mm² (real, not a bug).
- `cachedStats` is filled in cornerstone's render pass; with an instantaneous synthetic release the area in `MEASUREMENT_ADDED` can lag one frame. Human drags are fine, and the S-5.1 UPDATED stream delivers the settled value (A-23 removed the separate correction timer).
- `VIEWER_READY` is sent at once when a tool group exists and otherwise on the first `toolGroupService` VIEWPORT_ADDED (setToolActive is a silent no-op before a viewport exists); the bridge has no preRegistration since A-32.

## Contract duplication

- The contract is one published package, `@bdiadiun/scoring-contract` (A-15). The host and the fork both depend on it at an exact version; the fork no longer carries a copy. A merge into `main` that touches the package publishes a patch release.

## Facts added in slice 14

- A warm `node_modules` hid a broken dependency layout: after `npm ci`, Vitest could not find jsdom and ESLint could not resolve React types for Testing Library. Shared test tooling and React types now live in the root `package.json` (CONVENTIONS §1). Always verify with `npm ci` before gate 2.

## Follow-ups (out of current scope)

- Decision deferred to the end of the refactor (author, 2026-09-23): a study change inside the OHIF iframe. The form reads its study once per page load (A-19); OHIF's own worklist can still open another study in the iframe, after which every restore answers `unknown-study` and new measurements land in the old study's rows. Options on the table: hide the worklist in the fork (`showStudyList: false` / header customization) or let `VIEWER_READY` carry the study and the form follow it (contract change, canon entry). Until then: one page = one study, to be noted in DEFENCE.
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
4. Before gate 2 of any slice that touches `packages/*`: every changed package has its version
   raised in its own `package.json`, and every internal pin (channel → contract, bridge → contract
   and channel, adapter → bridge, host-app → contract and channel) names the new numbers. Slice 60
   forgot this and its PR #78 was superseded by the slice-61 PR, which carries both slices and one
   bump.
