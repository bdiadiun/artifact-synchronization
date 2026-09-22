# A-29 — the channel is transport, the bridge owns its state

Status: approved 2026-09-22. Canon: Q-1, Q-2, Q-4, Q-5, S-5.2, S-5.6. Supersedes the part of
[A-23](A-23-minimal-bridge.md) that moved the armed row, the once-only announcement and the
`reply` helper into the channel. Related: [A-24](A-24-plain-code.md),
[A-28](A-28-boundaries-as-schemas.md).

## Context

A-23 made the extension minimal by moving everything that "is protocol" into the channel. The
channel then knew what `ACTIVATE_TOOL.rowId` means, cleared its own state when it posted
`MEASUREMENT_ADDED`, remembered whether `VIEWER_READY` had gone out and mapped commands to their
answers. Each piece was small; together they made a 180-line viewer channel that the author could
not read in one pass, and a bridge that still had to ask the channel for its own state.

## Decision

- **The channel does transport only**: origin check, version, schema guard, typed `send`, one
  handler map per end (`onEach`), the host's queue-until-ready and `exchange`, `dispose`. The
  viewer end is `send`, `onEach`, `dispose`. Nothing in the channel reads a field of a message
  other than `type`, `requestId` and `causedBy`.
- **The bridge keeps the armed row** (`let armed` in `commands/handlers.ts`): set on `ACTIVATE_TOOL`,
  taken by the `MEASUREMENT_ADDED` path, cleared on `DEACTIVATE_TOOL` of that row.
- **"Announce once" is the subscriber's job**: `extension.ts` unsubscribes from `VIEWPORT_ADDED`
  after the first event and sends `VIEWER_READY`.
- **An answer is a plain `send` with `causedBy`**; the host settles an exchange on `causedBy`
  alone. No `reply` helper, no pending-removal map.
- **One handler map per end.** Each application registers its handlers once; the channel holds
  that map, not a registry of them.
- Three behaviour changes, each approved as an improvement or as harmless:
  1. A removal asked by the form now produces two events, OHIF's own `MEASUREMENT_REMOVED` and the
     answer with `causedBy`; the form ignores the first (the row is already gone) and the
     exchange consumes the second. The pending-removal map that suppressed the first is gone.
  2. Activating a row while another is drawing sends only `ACTIVATE_TOOL`; the viewer's armed
     row is replaced, the reducer already re-arms. No `DEACTIVATE_TOOL` for the previous row.
  3. Every `VIEWER_READY`, not only the first, restores the current rows that carry a uid and a
     geometry, then re-arms the drawing row. A viewer that reloads mid-session gets its
     annotations back; the `readyCount` and the separate "restored at mount" list are gone.

## Why this way

The reading rule "the channel is how a message travels; the bridge is what a message means" is
one sentence; A-23's rule needed a paragraph and a table of exceptions. The lines saved are the
smaller gain; the larger one is that each file now answers one question.
