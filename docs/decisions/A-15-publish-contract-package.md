# A-15 — the contract is published to npm as `@bdiadiun/scoring-contract`

Status: approved 2026-09-18. Canon: Q-7, D-1, A-1. Supersedes part of
[A-12](A-12-npm-workspaces.md).

## Context

A-12 kept the wire contract in two files: the package `packages/contract` and a byte-identical
copy inside the fork, with a hash check to catch drift. It listed publishing to a registry as the
right answer for a product and rejected it for the assignment, on the grounds that it adds a
release step and makes a clean-machine run depend on a published artefact.

Two things changed that reasoning. The duplication turned out to be wider than the one file: the
contract's own runtime guards were re-implemented in `host-app/src/form/storage.ts` and again in
the fork's `geometry.ts`, and they had already drifted — the contract accepted a point of any
length while the viewer would only restore a point of three coordinates. And the registry question
has a cheap answer: a public npm package is readable without authentication, so a reviewer's clean
clone installs it like any other dependency and needs no token.

## Decision

- The package is renamed `@bdiadiun/scoring-contract` and published to the public npm registry. It
  ships built JavaScript and declarations from `dist`, produced by the package's own `prepare`
  script, so a plain `npm ci` at the repository root builds it before anything imports it.
- The contract exports what both sides were re-implementing: the vocabulary and geometry shapes and
  the map from a tool name to the metric key it produces. (Since A-26 those are zod schemas —
  `ToolName`, `Metrics`, `MeasurementGeometry` — and the primitive guards this decision first
  exported are gone; `host-app/src/form/storage.ts` builds its stored-row schema from them.)
- A world point is exactly three finite coordinates, in the contract itself. This removes the
  drift: what the contract accepts is now what the viewer can restore.
- A workflow publishes a patch release when a merge into `main` changes the package. The version
  is derived in the workflow and not committed back, because direct commits to `main` are
  forbidden.
- The fork depends on the package at an exact version. The copy, the sync script, the hash file
  and `npm run check:contract` are gone.

## Why this way

One published package answers both halves of Q-7: the format has a single owner and an explicit
version, and the fork stops carrying a second copy of anything. Public npm keeps the reviewer's
clone free of tokens, which was the real objection in A-12; GitHub Packages was considered and
rejected because it demands authentication even to read a public package, so the fork could not
have dropped the copy at all.

## Consequences

- Changing the contract becomes two steps: publish, then raise the dependency in the fork. That is
  the cost of an explicit version, and it is the same cost any shared library carries.
- Publishing needs an `NPM_TOKEN` secret in the repository. Until it exists, the publish step of
  the workflow fails and nothing else is affected.
- `packages/contract/dist` is generated and ignored by git.
