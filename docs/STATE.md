# Project state journal

Read this first in every new session, after `CLAUDE.md`. Keep it short: it is a resume point,
not a log. Update it in every PR (same commit as the work it describes).

## Where we are

| Field | Value |
|---|---|
| Current slice | `chore: project tooling and state journal` (interim slice 0.5, branch `chore/project-tooling-and-state-journal`) |
| Gate | 2 — implemented, awaiting result approval |
| Last merged PR | #1 `docs: canon and feature graph` (2026-09-16) |
| Next slice | 1 `chore: bootstrap host-app` (F-01, F-02) — needs a gate-1 plan |

## Open decisions (see CANON.md → Decisions)

- A-1 mono-repo + submodule — pending approval (fork exists: https://github.com/bdiadiun/Viewers).
- A-3 `P-*` ID class, A-4 cancelled activation — pending approval.
- A-5 bridge decisions (Q-1, Q-3, Q-4, Q-6) — open, decided in slices 2–5.

## Facts worth not rediscovering

- OHIF `master` needs Node >= 24 + pnpm 11; release `v3.12.17` needs Node >= 18 + yarn 1 → A-6, we base on `v3.12.17`.
- Local toolchain: Node 22.13.1, npm 10.9.2; yarn/pnpm not installed (use corepack for yarn 1 in the fork).
- `gh pr merge` is blocked by the assistant's permission classifier; the user merges PRs after approval.
- Git pushes over HTTPS use `gh auth setup-git` as the credential helper.

## Session checklist

1. Read `CLAUDE.md`, this file, then the node rows of `docs/FEATURE-GRAPH.md` for the current slice.
2. Run `npm run check:graph`.
3. Continue from "Gate" above. Do not re-derive decisions already in `docs/decisions/`.
