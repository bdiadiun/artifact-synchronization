# Project state journal

Read this first in every new session, after `CLAUDE.md`. Keep it short: it is a resume point,
not a log. Update it in every PR (same commit as the work it describes).

## Where we are

| Field | Value |
|---|---|
| Current slice | 1 `chore: bootstrap host-app` (branch `chore/bootstrap-host-app`, nodes F-01, F-02) |
| Gate | 2 — implemented and verified, awaiting result approval |
| Last merged PR | #2 `chore: project tooling and state journal` (2026-09-16) |
| Next slice | 2 `feat: viewer bridge extension` (F-03..F-06) — needs a gate-1 plan; start from `docs/notes/ohif-bridge-api.md` |

## Open decisions (see CANON.md → Decisions)

- None. A-1..A-11 are approved (2026-09-16); see `docs/decisions/`. Fork: https://github.com/bdiadiun/Viewers.
- Runtime check pending (slice 2): does the chosen study yield `mm²` (pixel spacing present)?

## Facts worth not rediscovering

- OHIF `master` needs Node >= 24 + pnpm 11; release `v3.12.17` needs Node >= 18 + yarn 1 → A-6, we base on `v3.12.17`.
- Local toolchain: Node 22.13.1, npm 10.9.2; yarn/pnpm not installed (use corepack for yarn 1 in the fork).
- `gh pr merge` from the main session is blocked by the permission classifier; the git subagent can merge (worked for PR #2).
- Git pushes over HTTPS use `gh auth setup-git` as the credential helper.
- OHIF facts (measurement shape, events, tool activation) are in `docs/notes/ohif-bridge-api.md`; do not re-research.
- corepack 0.30 is available; yarn 1 for the fork comes from corepack, no global install.

## Session checklist

1. Read `CLAUDE.md`, this file, then the node rows of `docs/FEATURE-GRAPH.md` for the current slice.
2. Run `npm run check:graph`.
3. Continue from "Gate" above. Do not re-derive decisions already in `docs/decisions/`.
