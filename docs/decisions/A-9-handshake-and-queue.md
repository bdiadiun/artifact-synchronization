# A-9 — Handshake: `ready` flag and an uncoalesced FIFO command queue

Status: approved 2026-09-16. Canon: Q-1, C-4.4.1, P-1, P-9.

## Context
The host must not send commands before `VIEWER_READY`, and a click during iframe load must not be lost.

## Decision
- The host bridge client keeps `ready: boolean` and `queue: HostCommand[]`.
- `send(cmd)`: if not ready, push to the queue; else `postMessage` to the iframe's `contentWindow`
  with `targetOrigin = VIEWER_ORIGIN`.
- On `VIEWER_READY`: set `ready`, flush the queue in order. No coalescing (an ACTIVATE followed by a
  DEACTIVATE for the same row are both sent; the viewer ends in the right state anyway).
- A second `VIEWER_READY` (iframe reload) resets `ready`, then re-sends `ACTIVATE_TOOL` for the row
  currently in `Drawing…`, if any.
- Bridge state (`ready`, queue length, last message) is exposed for a small dev status line, so a
  missing `VIEWER_READY` is diagnosable on screen (P-9).

## Rejected alternatives
- Dropping early commands: violates Q-1.
- Polling the iframe until it answers: extra protocol for no gain.
- Smart queue coalescing: more code paths to defend, no user-visible benefit.

## Consequences
- The queue is the answer to P-1; the dev status line is the answer to P-9.
