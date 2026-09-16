# A-12 — npm workspaces for host-app and the contract package; the viewer stays outside

Status: approved 2026-09-16. Canon: Q-7, D-1, A-1.

## Context

The mono-repo holds `host-app/`, the shared message contract, and the OHIF fork as a git
submodule. The fork is a yarn 1 monorepo with its own workspaces and must remain a
self-contained repository.

## Decision

- Root `package.json` declares npm workspaces `host-app` and `packages/*`.
- The contract is the package `@scoring/contract` in `packages/contract/`, consumed by
  `host-app` as a regular dependency (symlinked by npm). TypeScript source is consumed directly;
  no build step.
- `viewer/` (the submodule) is not a workspace. The bridge extension holds a byte-identical copy
  of `packages/contract/src/messages.ts`, verified by `npm run check:contract`.

## Rejected alternatives

- Vite alias to a shared folder: works, but hides the dependency and does not scale to more packages.
- Making the extension import from outside the submodule: breaks the fork as a standalone repo.
- Publishing the contract to a registry: overkill for this assignment.

## Consequences

- One root `package-lock.json`; `npm install` at the root installs host-app and the package.
- The fork is installed separately with yarn (`viewer/`), documented in README.
