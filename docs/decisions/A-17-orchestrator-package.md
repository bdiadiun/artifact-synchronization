# A-17 — the viewer client is its own package, `@bdiadiun/scoring-orchestrator`

Status: approved 2026-09-20. Canon: C-4.1.1, Q-1, Q-2, Q-3, Q-4, D-1. Related:
[A-15](A-15-publish-contract-package.md), [A-16](A-16-adapter-and-viewer-delivery.md).

## Context

The code that talks to a viewer lived inside the React form, under `host-app/src/bridge/`. That
placement said something untrue about the design: it made the channel look like a detail of this
particular form, when in fact the form is one possible consumer of it.

The shape the channel should have became clear once the viewer was treated as a deployed
application rather than as part of this repository (A-16). There can be several viewers, at
different versions and at different addresses, while the piece that speaks to them stays one.

## Decision

- The client half of the channel is the package `@bdiadiun/scoring-orchestrator`, published to the
  public npm registry alongside the contract, built to `dist` by its own `prepare` script.
- It owns the handshake and the queue that holds commands until `VIEWER_READY`, the origin check on
  every inbound message, the explicit target origin on every outbound one, the listener set, the
  disarm on teardown, and the command builders.
- It depends on `@bdiadiun/scoring-contract` and on nothing else. No React, no strings meant for a
  person, nothing from `host-app`.
- The React binding stays in the form as `hooks/useBridge.ts`. A framework binding belongs to the
  application that chose the framework.
- A viewer is addressed by configuration, so a second or a fifth viewer is a configuration change
  rather than a code change.

## Why this way

Three packages now divide along the lines of what changes together. The contract changes when the
format changes. The orchestrator changes when the conversation changes. The form changes when what
a person sees changes. Before this, the second and the third were the same file tree, so a change
to either looked like a change to both.

It also makes the safety rules of this assignment testable in one place. The origin check, the
refusal to post with a wildcard target, the queueing before the handshake and the echo guard are
properties of the channel, not of the form, and they are now enforced by a package with its own
tests that any host gets for free.

The alternative was to leave the channel in the form and accept that a second host would copy it.
That is the same mistake the contract made before A-15, and it had already produced two divergent
copies of the same guards.

## Consequences

- The two packages form a TypeScript project-reference chain: building the orchestrator builds the
  contract first, so the order belongs to the compiler rather than to whichever workspace the
  package manager happens to run first. A fresh clone therefore installs, which it did not when
  each package merely built itself.
- A change to the channel is published and then consumed, exactly like a contract change.
- The form's dependency list now names both packages, which is the honest picture of what it is
  built from.
- `host-app/src/bridge/` and `host-app/src/form/commands.ts` no longer exist.
