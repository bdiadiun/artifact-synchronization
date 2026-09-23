# A-23 — a minimal bridge

> Partly superseded by [A-29](A-29-channel-is-transport.md): the armed row, the once-only
> announcement and `reply` went back to the extension; the channel is transport only.: the extension keeps what is about OHIF, the channel keeps the protocol

Status: approved 2026-09-22. Canon: C-4.3, C-4.3.6, Q-1, Q-3, Q-4, Q-5, X-5. Builds on
[A-22](A-22-one-channel-api.md), [A-8](A-8-id-correlation.md), A-10, [A-9](A-9-handshake-and-queue.md).
Supersedes the "restore the tool that was active before arming" part of A-8.

## Context

The viewer extension had grown to ~1 500 non-test lines in 24 files for a job that reads as: hook
OHIF's measurement events and post them, receive a command and call OHIF. Read against that job,
three kinds of weight stood out. About a third was ceremony (a props file and a deps interface
per module, a factory for one variable). About a third was our own cleverness that the form or
OHIF already covered: a snapshot of the previous tool, a 150 ms timer correcting `cachedStats`
that the live-update stream corrects anyway, a `uid → rowId` map gating updates the form filters
itself, two de-duplication sets, a geometry re-check the contract guard had done. And the handshake
was split down the middle: the host half in the channel, the viewer half in the extension.

## Decision

- **The extension holds only what is about OHIF**: activating a tool and returning to the
  default one, reading a measurement's `cachedStats` into `metrics` and `geometry`, rebuilding an
  annotation on restore, the version overlay. Six modules, no props files, no deps interfaces; a
  type used by one file is declared there without `export`.
- **The channel's viewer end holds the protocol**: `announceReady(payload)` sends `VIEWER_READY`
  once and retries until a parent window exists; `getArmed()` mirrors the host's memory of the
  armed row from the incoming `ACTIVATE_TOOL` / `DEACTIVATE_TOOL` and clears it once the matching
  `MEASUREMENT_ADDED` went out; `reply(command, payload)` sends the event the contract's answer
  table pairs with a command, `causedBy` filled in, and a wrong answer shape is a compile error.
  The channel logs each message it sends or admits, once.
- **After a measurement, a cancel or a page hide, the viewer returns to the fixed default tool**
  (`WindowLevel`, OHIF's default primary tool in this mode). The canon asks that the tool
  deactivates; remembering what was active before was the one reason the extension had to keep
  tool state.
- **`MEASUREMENT_UPDATED` is sent for every annotation**, throttled per uid. The form ignores a
  uid it does not hold, so the extension keeps no map of which uids belong to rows.
- **Nothing is de-duplicated in the extension**: OHIF emits one `MEASUREMENT_ADDED` per uid, and a
  repeated `MEASUREMENT_UPDATED` with the same value is harmless to the reducer.
- **The ADDED correction timer is gone**: a value that settles one render late arrives through
  the update stream, which exists since S-5.1.
- **`ArmedRow { rowId, requestId }` is the viewer channel's type** (since A-27; it was declared in
  the contract until only the channel used it), the one correlation the viewer end keeps.

## Why this way

Every item removed was checked against the message the host receives; none changes. What moved
into the channel passes one test: it is understandable without OHIF. What stays in the extension
fails that test. Throttling stayed in the extension on purpose: keying it by `measurementUid`
would teach the channel a field of one message.

## Consequences

- The wire is unchanged; the browser scenario is the acceptance test.
- A stale `DEACTIVATE_TOOL` arriving while nothing is armed now re-activates the default tool
  instead of being ignored; both leave the viewer on the default tool.
- A failed `setToolActive` (no tool group) leaves the row armed in the channel, so a drawing made
  from the toolbar right then would be attributed to it. Commands are held until `VIEWER_READY`,
  which waits for the first tool group, so the case needs the viewer to lose its viewport between
  the two; it is logged.
