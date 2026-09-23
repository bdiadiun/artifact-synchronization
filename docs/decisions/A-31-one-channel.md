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

- **One factory, one interface.** `createChannel({ peerOrigin, accept, readyOn?, peerWindow? })`
  returns `{ send, onMessage, getState, subscribe, dispose }` on both sides. `accept` is the
  contract guard for what this end receives (`isViewerEvent` in the form, `isHostCommand` in the
  extension); the type of what it sends is "everything else in the contract". `readyOn` names the
  message that opens the way out: until it arrives, `send` queues; every arrival of it flushes the
  queue in order and counts as one more `announcements` in the state, so an application can react
  to a peer that announced itself again (a viewer reload). Without `readyOn` the end is ready at
  once. The viewer names its peer window
  (`window.parent`); the host names none and learns it from the source of the first message it
  accepts, its `VIEWER_READY` — so the form never needs a reference to the iframe.
- **No incoming queue of our own.** `postMessage` delivers into the receiving window's task queue,
  one `message` event at a time, in order per source; that is the queue. Our end adds only the
  origin check, the version check, the schema guard and one handler. Bursts (a handle being
  dragged) are throttled where they are produced, in the extension; the only outgoing queue is the
  one `readyOn` opens.
- **No `DEACTIVATE_TOOL` on unmount, no dispose on `pagehide`.** The host application has one
  channel per page, alive as long as the page; the hook unsubscribes what it subscribed (Q-5) and
  the channel has nothing outside the page to release. The viewer is this page's iframe and dies
  with the page, so there is no tool left to cancel; the channel does not know what a row is. The
  extension does dispose on `pagehide`, because it holds OHIF subscriptions and an active tool.

## Why this way

One file answers "how does a message travel" for both applications, and the platform's ordering
guarantee is a stronger argument at the defence than a queue of our own. The `Exclude` on `send`
is the only type expression in the package.
