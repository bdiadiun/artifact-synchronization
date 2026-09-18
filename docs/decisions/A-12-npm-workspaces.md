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

## Why the contract is duplicated, and why that is acceptable

The wire contract exists twice: `packages/contract/src/messages.ts` and a byte-identical copy at
`viewer/extensions/scoring-bridge/src/contract/messages.ts`. Duplication is normally a defect, so
the reasoning is spelled out here.

- The fork is a separate repository mounted as a submodule. Its yarn workspaces resolve only
  inside the fork, so the extension cannot import a package that lives above the submodule root.
- The fork must keep building from a standalone clone: it has its own pull requests and its own
  history, and a reviewer may open it alone.
- The assignment allows this explicitly (Q-7: a separate package, a shared folder, "or at least a
  copied file with an explanation why").
- Drift is caught mechanically rather than by discipline: `npm run check:contract` compares the two
  files and the committed hash on every pull request here, and a workflow in the fork checks its
  own copy against that hash, so a change made only inside the fork fails there too.
  `npm run contract:sync` performs the copy, so updating the contract is one command.

## Rejected alternatives for the duplication

- **Publishing `@scoring/contract` to npm** and depending on it from the fork. This is the right
  answer for a product: one source, an explicit version, no copying. It was rejected for the
  assignment because it adds a registry, a release step and a version bump to every contract
  change, and it makes a reviewer's clean-machine run depend on a published artefact.
- **A `file:` dependency from the fork to `packages/contract`.** It breaks the standalone clone:
  the path escapes the fork's repository root.
- **Moving the contract into the fork** and importing it from host-app through an alias. The
  duplication disappears, but the viewer becomes the owner of a format both sides share, and
  host-app stops building without the submodule.

- Vite alias to a shared folder: works, but hides the dependency and does not scale to more packages.
- Making the extension import from outside the submodule: breaks the fork as a standalone repo.
- Publishing the contract to a registry: overkill for this assignment.

## Consequences

- One root `package-lock.json`; `npm install` at the root installs host-app and the package.
- The fork is installed separately with yarn (`viewer/`), documented in README.
