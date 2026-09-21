# A-21 — one channel package, with `send`, `on` and `exchange`

Status: approved 2026-09-21. Canon: Q-1, Q-2, Q-3, Q-4, Q-7. Related:
[A-15](A-15-publish-contract-package.md), [A-17](A-17-orchestrator-package.md),
[A-20](A-20-three-layers.md).

## Context

Both sides of the conversation do the same three things before anything else happens: compare
`event.origin` against the one origin they accept, run the incoming value through the contract's
guard, and post with an explicit target origin, never a wildcard. That is written twice today, once
in the orchestrator and once in the viewer extension, and the two copies can drift without anything
noticing. It is also the rule whose failure costs the most.

The messages are symmetric, five in each direction, and the mechanics are identical; only the
vocabulary and the direction differ. What is genuinely asymmetric stays where it belongs: the queue
that holds commands until `VIEWER_READY` is the host's, and the throttled stream of updates during
a drag is the viewer's.

Two message pairs are already requests with answers, `REMOVE_MEASUREMENT` answered by
`MEASUREMENT_REMOVED` and `RESTORE_MEASUREMENTS` answered by `MEASUREMENTS_RESTORED`, correlated by
`causedBy`. Each pair is wired by hand, and nothing notices when an answer never comes: a removal
request for a measurement the viewer no longer held once left its id in memory for the life of the
page, and the fix was to make the viewer always answer rather than to make silence detectable.

## Decision

- One package, `@bdiadiun/scoring-channel`, holds the mechanics and is used by both sides. It is
  parameterised at each end by the origin it accepts, the guard that admits an incoming message and
  the way it reaches the other window.
- Its surface is generic, not a method per message: `send(type, payload)`, `on(type, handler)` and
  `exchange(type, payload)`. The payload type follows from the message type, so nothing is hand
  written per message and neither side can forget to update the other.
- The channel fills in what is always the same: `version` and the request id. Neither appears at a
  call site again.
- `exchange` returns the answer, resolved by correlation, and rejects when none arrives within a
  timeout. Silence becomes an error instead of an unbounded wait.
- The contract gains the table that says which event answers which command. Without it `exchange`
  cannot know the type of what it is waiting for.
- One-way messages stay one-way. A stream of updates during a drag has no answer, and inventing one
  would be worse than useless.

## Why this way

The origin check, the guard and the explicit target are the assignment's security requirements.
Implemented once, they are tested once and every consumer gets them; implemented twice, they are a
pair of copies that agree only as long as someone keeps checking.

The generic surface was chosen over a method per message deliberately. Twenty hand-written wrappers
that only build a message are ceremony, and each is a place to forget a field; the typed pair of
`send` and `on` cannot be out of step with the contract, because it is derived from it.

The facade is not a separate package. A package is a version, a release and a pin in several
places; for a protocol of ten messages, four published artefacts would be more machinery than the
problem deserves. The boundary between the mechanics and the facade is drawn inside the package
instead, so splitting later is cheap if it is ever worth it.

## Consequences

- A new message type is a change to the contract and a handler on one side. Neither side needs a
  new method.
- An answer that never comes is reported where it happens, with the request that went unanswered.
- The facade must stay thin. When a method starts doing more than composing a message and awaiting
  its answer, it has stopped being the channel and belongs to the orchestrator or the extension.
