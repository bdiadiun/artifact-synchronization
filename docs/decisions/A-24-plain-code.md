# A-24 — plain code: readability outranks reuse at the seam between the two ends

Status: approved 2026-09-22. Canon: Q-7, D-2. Related: [A-21](A-21-channel-and-exchange.md),
[A-22](A-22-one-channel-api.md), [A-23](A-23-minimal-bridge.md).

## Context

The channel had one generic core, `createChannel<TIncoming, TOutgoing>`, so that the transport was
written once for both ends. The price was a set of types that existed only to make that core type
check — `MessageOfType`, `PayloadOf`, `StoredHandler`, `AnswerMessage`, `Deliver`, `ChannelGate` —
a curried factory returning a generic function, and casts through `unknown`. Read by its author,
the package was "a skyscraper": correct, and impossible to keep in one head. The same reading found
comments that restated the code and three-line citations of OHIF above every call.

## Decision

- **Each end is written on its own, with concrete types.** `createHostChannel` and
  `createViewerChannel` read top to bottom; what they share is three plain functions — posting to
  a peer, listening from a peer, waiting for answers. The thirty lines the two ends have in common
  are duplicated on purpose.
- **No type exists only to make a signature type-check.** One generic on `send`, `onEach`,
  `exchange` and `reply` gives the caller typed payloads and is the whole allowance; no type
  parameter is threaded through a shared core; no `as unknown as`. A cast that remains carries
  its one-line reason.
- **A guard is a function, not a table.** Each message has a named guard and the union guard is a
  `switch` whose `default` fails the build when a type is added.
- **A comment says only what the code cannot**: the reason, a decision id, or one sentence ending
  in the OHIF `file:line` that justifies a call that would otherwise look wrong. Under 10% of the
  non-blank lines of a package. What is longer lives in `docs/notes/`.

## Why this way

The code base exists to be defended by one person from memory. A repeated thirty lines cost a
minute to read; a generic core cost an afternoon. DRY (A-13's "declared once") still holds for
data — the contract, the vocabulary, the guards — and stops at the point where sharing needs a
type to explain itself.
