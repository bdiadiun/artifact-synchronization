# A-30 — one correlation: `rowId` ↔ `measurementUid`; no request/answer layer

Status: approved 2026-09-22. Canon: C-4.3.5, Q-3, Q-4, S-5.2, S-5.6. Supersedes
[A-10](A-10-echo-guard.md) as the echo-loop mechanism and [A-21](A-21-channel-and-exchange.md)
entirely; narrows [A-8](A-8-id-correlation.md) to its first sentence. Related:
[A-29](A-29-channel-is-transport.md).

## Context

The assignment asks for one deliberate correlation: who issues the row id, who issues the
measurement id, and how the two are matched. On top of that the code carried a second one: every
command had a `requestId`, events answered with `causedBy`, the host end kept a table of pending
requests with a five-second timeout, the contract kept a table of which event answers which
command, and the form logged an "unanswered request". Nothing on screen depended on any of it; the
row was removed from the form before the request left, and a restore reply is the only
`MEASUREMENTS_RESTORED` a session ever sees.

## Decision

- **Commands carry no `requestId`; events carry no `causedBy`.** `ACTIVATE_TOOL { rowId, toolName }`,
  `DEACTIVATE_TOOL { rowId }`, `REMOVE_MEASUREMENT { measurementUid }`,
  `FOCUS_MEASUREMENT { measurementUid }`, `RESTORE_MEASUREMENTS { studyInstanceUid, measurements }`;
  `MEASUREMENT_ADDED { rowId | null, measurementUid, toolName, metrics, geometry? }`,
  `MEASUREMENT_UPDATED`, `MEASUREMENT_REMOVED { measurementUid }`,
  `MEASUREMENTS_RESTORED { restored, failed }`.
- **The host issues `rowId` before drawing; the viewer issues `measurementUid` when the annotation
  exists; `MEASUREMENT_ADDED` carries both** and the form stores the pair. Every later event names
  the `measurementUid` and the form finds the row by it.
- **No echo loop, by one rule on each side**: the form reacts to an event only by changing its
  state, never by sending a command; the extension reacts to a command only by acting on OHIF,
  never by sending an event itself (events come from OHIF's own `measurementService`). The one
  reflection — `REMOVE_MEASUREMENT` → OHIF → `MEASUREMENT_REMOVED` — reaches a form whose row is
  already gone; the reducer ignores an unknown uid.
- **`exchange`, `pendingAnswers`, the answer table and the timeout are removed.** A removal is
  fire-and-forget; `MEASUREMENTS_RESTORED` is handled like any other event.

## Why this way

The assignment's correlation question has a one-sentence answer again, and the "where could a
loop start" question is answered by pointing at two handlers instead of at a mechanism. What is
lost is a console warning when the viewer never confirms a removal, which nothing on screen
depended on.
