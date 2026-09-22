# A-31 — one channel for both ends; the browser's task queue is the queue

Status: approved 2026-09-22. Canon: Q-1, Q-2, Q-5, Q-7. Supersedes [A-22](A-22-one-channel-api.md)
where it describes two factories. Related: [A-29](A-29-channel-is-transport.md),
[A-30](A-30-no-request-answer.md).

## Context

After A-29 and A-30 the two ends of the channel differed in two things only: the host waits for
`VIEWER_READY` before it sends, and the host cancelled the armed row when it was disposed. Two
factories with two interfaces meant two places to read and two places to check. The author also
asked whether a queue of incoming messages with routing was needed for bursts of events.

## Decision

- **One factory, one interface.** `createChannel({ peerOrigin, getPeerWindow, accept, readyOn? })`
  returns `{ send, onMessage, getState, subscribe, dispose }` on both sides. `accept` is the
  contract guard for what this end receives (`isViewerEvent` in the form, `isHostCommand` in the
  extension); the type of what it sends is "everything else in the contract". `readyOn` names the
  message that opens the way out: until it arrives, `send` queues; every arrival of it flushes the
  queue in order. Without `readyOn` the end is ready at once.
- **No incoming queue of our own.** `postMessage` delivers into the receiving window's task queue,
  one `message` event at a time, in order per source; that is the queue. Our end adds only the
  origin check, the version check, the schema guard and one handler. Bursts (a handle being
  dragged) are throttled where they are produced, in the extension; the only outgoing queue is the
  one `readyOn` opens.
- **The armed-row cancel on unmount is the application's**: `useHostChannel` receives a function
  that names the drawing row and sends `DEACTIVATE_TOOL` for it before disposing the channel
  (Q-5). The channel does not know what a row is.

## Why this way

One file answers "how does a message travel" for both applications, and the platform's ordering
guarantee is a stronger argument at the defence than a queue of our own. The `Exclude` on `send`
is the only type expression in the package.
