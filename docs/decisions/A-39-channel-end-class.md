# A-39 — the end of the channel is a class

Status: approved 2026-09-23. Canon: Q-1, Q-2, Q-5, Q-7. Related: [A-34](A-34-two-applications-one-channel-hook.md),
[A-36](A-36-row-model-folder.md).

## Context

Since A-34 the channel package holds one end of the channel per window, created when its module
loads. The first version wrote that end as module-level variables and functions — a singleton by
convention. The author asked whether that procedural shape was right, and chose a class: the end
has state and behaviour and exists once, which is what a class instance is for.

## Decision

- **`class ChannelEnd`** in `packages/channel/src/channel.ts`: private fields for the state
  (`queued`, `listeners`, `peer`, `target`, `state`, `handle`, `leases`, `stopListening`),
  public arrow-function fields `send`, `on`, `getState`, `subscribe`, `listen`, private ones
  `publish`, `open`, `receive`, `samePeer`. Methods are arrow fields, not prototype methods,
  because they are passed by reference (`useSyncExternalStore(channel.subscribe, channel.getState)`,
  the `listen` effect) and must keep their `this`.
- **One instance per window**: `const channel = new ChannelEnd();` at module level; `useChannel`
  returns it as `Channel<TIn>` (the public interface, the options and the state type are
  unchanged; the one type assertion stays inside `on`).
- **Where a class is right** (CONVENTIONS §2): state with behaviour in one instance. Not for a
  model without instances (`RowModel` stays an object of functions, A-36) and not for a reducer
  or a hook.
- Released as channel 0.0.9; scoring-viewer 0.1.1 and ohif-extension-loader 0.1.1 take it; the
  fork follows with its entry (A-20).

## Why this way

`private` says what the module-level `let` only implied, the fields read as the state of one
thing, and the methods as its behaviour; nothing else changes — the same lines, the same one
assertion, the same tests. Rejected: keeping the module variables (the author found the
procedural shape harder to read), a factory called once at module level (the same variables one
level deeper), and static-only classes (a namespace, which the lint set refuses and A-36 already
answered).
