# A-26 — the contract is declared once, as zod schemas

Status: approved 2026-09-22. Canon: Q-7, X-5. Related: [A-24](A-24-plain-code.md),
[A-25](A-25-version-in-the-channel.md).

## Context

Every message was written twice: an interface in a `.props.ts` file and a hand-written guard beside
it, kept in step by hand, plus a file of primitive guards to build the second from. The guards were
correct and unreadable; the author could not learn them.

## Decision

- **One schema per message**, a `z.object` with the fields and their constraints; `HostCommand` and
  `ViewerEvent` are `z.discriminatedUnion('type', …)`; the TypeScript types are `z.infer` of the
  schemas; `isHostCommand` / `isViewerEvent` are `safeParse(...).success`.
- **The vocabulary is `z.enum`** (tool names, units, restore-failure reasons); the metric and
  geometry shapes are schemas the message schemas reuse, and the contract exports them so a
  consumer can build its own schema on top of them.
- **`zod` is the contract package's only dependency** and the first library added to this project;
  the viewer receives it through the contract. The host application lists it as well, because its
  stored-state schema (A-14) is built from the contract's schemas.
- Nothing on the wire changes. A schema ignores keys it does not declare, which is how the channel's
  `version` field (A-25) passes through a guard the contract never mentions it in.

## Why this way

A schema is read once and says both what a message is and how it is checked. The alternative
without a dependency, a small `shape()` helper of our own, would have kept the interfaces separate
from the checks and added an abstraction to remember. Thirteen kilobytes in each bundle is the
price; the contract shrinks from ~390 lines to ~130.
