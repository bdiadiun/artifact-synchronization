# A-6 — OHIF fork branch based on release tag `v3.12.17`

Status: approved 2026-09-16. Canon: C-4.1.1, D-5.

## Context
Upstream `master` (3.14.0-beta) requires Node >= 24 and pnpm 11. The latest stable release
`v3.12.17` (2026-09-10) requires Node >= 18 and yarn 1.22. The development machine has Node 22.

## Decision
Our fork branch is created from tag `v3.12.17`. The bridge extension targets that API.
Node is pinned via `.nvmrc` (22) at the repository root; yarn 1 is enabled through corepack.

## Rejected alternatives
- Tracking `master`: moving target, forces a Node/pnpm upgrade on every reviewer's machine.

## Consequences
- The README lists Node 22 and corepack as the only prerequisites.
- Upgrading OHIF later is a deliberate decision, not a side effect of `git pull`.
