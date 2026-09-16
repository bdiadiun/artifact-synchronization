# A-10 — Echo-loop protection

Status: approved 2026-09-16. Canon: Q-4, P-6.

## Context
`measurementService.update(...)` and `remove(...)` re-broadcast `MEASUREMENT_UPDATED` / `REMOVED`.
If the host reacts to those by sending a command that triggers the same service call, the two apps
ping-pong forever.

## Decision
- Mandatory part: the host never sends a command in reaction to a `MEASUREMENT_*` event. No loop by
  construction.
- Bonus tasks (S-5.1, S-5.2): every host command carries a `requestId`; when the bridge executes a
  command that provokes a service event, the outgoing event carries `causedBy: requestId`. The host
  ignores events whose `causedBy` it issued. Additionally, commands are idempotent: the host does not
  send a command when its state already matches (e.g. a row already cleared is not deleted again).
- `MEASUREMENT_UPDATED` is throttled on the viewer side (it fires per drag frame).

## Rejected alternatives
- Suppressing events by a global "muted" flag: races with genuine user edits during the window.

## Consequences
- The loop point to show at the defence (P-6) is the bridge handler for `DEACTIVATE_TOOL`/delete
  and the `MEASUREMENT_REMOVED` subscriber.
