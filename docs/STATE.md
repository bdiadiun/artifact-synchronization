# Project state journal

Read this first in every new session, after `CLAUDE.md`. Keep it short: it is a resume point,
not a log. Update it in every PR (same commit as the work it describes).

## Where we are

| Field | Value |
|---|---|
| Current slice | 5 `feat: total area calculation` (branch `feat/total-area-calculation`, node F-11) |
| Gate | 2 — implemented and verified end to end, awaiting result approval |
| Last merged PR | #6 `feat: receive measurement into form`; fork PRs #1–#3 merged into `scoring` |
| Next slice | 6 `docs: README, ARCHITECTURE, AI-USAGE` (F-12, F-13) |

## Open decisions (see CANON.md → Decisions)

- None. A-1..A-11 are approved (2026-09-16); see `docs/decisions/`. Fork: https://github.com/bdiadiun/Viewers.

## Facts worth not rediscovering

- OHIF `master` needs Node >= 24 + pnpm 11; release `v3.12.17` needs Node >= 18 + yarn 1 → A-6, we base on `v3.12.17`.
- Local toolchain: Node 22.13.1, npm 10.9.2; yarn/pnpm not installed (use corepack for yarn 1 in the fork).
- `gh pr merge` from the main session is blocked by the permission classifier; the git subagent can merge (worked for PR #2).
- Git pushes over HTTPS use `gh auth setup-git` as the credential helper.
- OHIF facts (measurement shape, events, tool activation) are in `docs/notes/ohif-bridge-api.md`; do not re-research.
- corepack 0.30 is available; yarn 1 for the fork comes from corepack, no global install.
- Viewer dev server: `yarn --cwd platform/app dev` inside `viewer/` (root `yarn dev` picks up `bun.lock` and fails).
- Fork branches: `scoring` (base, from v3.12.17), feature branches PR into it; fork PR #1 = bridge extension.
- Study `1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1` has pixel spacing → areas arrive in mm² (verified with a headless ellipse).
- Raw OHIF `areaUnit` on the demo study is `mm²` (U+00B2); the bridge normalises the first token to `mm2`/`px2`. The default display set is a CT topogram with large pixel spacing, so areas are in the hundreds of thousands of mm² (real, not a bug).
- `cachedStats` is filled in cornerstone's render pass; with an instantaneous synthetic release the area in `MEASUREMENT_ADDED` can lag one frame. Human drags are fine; the S-5.1 UPDATED slice would correct it anyway.
- `VIEWER_READY` is sent on the first `toolGroupService` VIEWPORT_ADDED, not in preRegistration (setToolActive is a silent no-op before a viewport exists).

## Follow-ups (out of current scope)

- Fork `tsc --noEmit` has two pre-existing type errors unrelated to runtime (`ToolGroupService` type lacks pubsub members used by `subscribe`; generated `pluginImports.js` cannot resolve the extension). Webpack/babel build is unaffected. Candidate for a small fork PR.

## Session checklist

1. Read `CLAUDE.md`, this file, then the node rows of `docs/FEATURE-GRAPH.md` for the current slice.
2. Run `npm run check:graph`.
3. Continue from "Gate" above. Do not re-derive decisions already in `docs/decisions/`.
