# A-22 — one channel API for both ends; the orchestrator package goes away

Status: approved 2026-09-22. Canon: Q-1, Q-2, Q-3, Q-4, Q-5, Q-7, X-5. Supersedes
[A-17](A-17-orchestrator-package.md) and the handler-registry part of
[A-16](A-16-adapter-and-viewer-delivery.md). Builds on
[A-21](A-21-channel-and-exchange.md), [A-9](A-9-handshake-and-queue.md) and A-10.

## Context

A read of every non-test line (4 556 of them) found one idea implemented two and three times. The
channel offered a per-type `on`, yet the host registered one handler for every type, folded each
event into a `lastEvent` field of a state store, pushed that through React state, and switched on
the type again inside an effect; the viewer did not use `createChannel` at all and kept a second
per-type dispatcher, its registry, while writing `version: 1` by hand in six places. The host's own
part of the conversation, a queue and a ready flag, about eighty lines of substance, had become a
published package of seven files and five factories. An event crossed six hands before it changed
a row, and because it travelled as React state, two events arriving before one render could lose
the first.

## Decision

- **Three layers, one question each.** The contract is the wire format. The channel is the whole
  communication API. The two applications, the form and the viewer extension, raise a channel and
  use its methods; neither touches `postMessage`, `version`, a request id or a target origin.
- **The channel owns what it was being handed.** The channel end takes the peer (its origin and how
  to find its window), the guard for what comes in, and optionally the incoming message that opens
  the way out. It builds its own post, its own outgoing queue and its own observable state
  (`ready`, `queued`). The host end names `VIEWER_READY` as that message and adds the one thing
  that is the host's alone: cancelling the armed row on unmount while the channel is still live.
  The viewer end is open from the start.
- **One dispatch path.** A set of handlers is registered once with `onEach` and checked against
  the contract with `satisfies`, on both ends. An event goes channel → handler → reducer; it never
  travels as React state, and `lastEvent` does not exist. React reads only `ready` and `queued`,
  through `useSyncExternalStore`.
- **`@bdiadiun/scoring-orchestrator` is no longer released.** Its published versions stay in the
  registry, as every published version does; nothing depends on them.
- **The form keeps its reducer.** Rows, their statuses and the totals are the form's own state and
  mean nothing to the viewer end, which imports the same channel package; a reducer inside the
  channel would ship form logic to the viewer and tie the transport to one consumer, the coupling
  A-17 was written to remove. The reducer stays the single place a row changes, which is why the
  event handlers no longer repeat its guards.

## Why this way

The alternative considered first was to keep the orchestrator and thin it. It would still have been
a package whose only job was to call another package, and the form would still have needed a
binding to it. Keeping `lastEvent` with a queue of events behind it would have cured the lost-event
risk and kept the layer that caused it.

A-17's reason stands and is kept: the form is one possible consumer of the channel, so nothing of
the form lives in it. What A-17 added beyond that, a second package, was the cost without the
benefit once A-21 had put the transport in a package both ends share.

## Consequences

- A-24 later replaced the shared generic core with two concrete ends; the decision above about
  what the channel owns is unchanged.

- The status line shows readiness and the queue length; the type of the last event is gone from
  it. It was a development aid and the same information is in the console under each end's prefix.
- A capability is still added without editing a dispatcher: a new command is a new key in the
  viewer's handler map, and the `satisfies` clause fails the build until it is there.
- Test seams that existed only as options (an injected window, timeout and request id) are gone;
  tests drive the real `window` with `MessageEvent`s and fake timers.
