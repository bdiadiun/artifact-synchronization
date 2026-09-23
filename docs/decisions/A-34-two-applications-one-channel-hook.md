# A-34 — two applications, one `useChannel`, one way to subscribe, one action type

Status: approved 2026-09-23. Canon: C-3.4, C-4.3.4, C-4.3.5, Q-1, Q-2, Q-5, S-5.1, S-5.6. Supersedes
[A-31](A-31-one-channel.md) where it lists the channel's interface, [A-32](A-32-react-bridge.md)
where it describes the hook and its effects, and items 1, 4 and 5 of
[A-33](A-33-review-of-the-boundaries-refactor.md). Related: [A-29](A-29-channel-is-transport.md),
[A-30](A-30-no-request-answer.md).

## Context

After A-33 the two ends still connected to the channel differently: the form imported a module
singleton and subscribed with `onMessage`, the extension created a channel inside an effect and
`dispose`d it in the cleanup; the extension subscribed to OHIF through three functions of three
shapes; the form armed a row with a reducer action and then sent a command with almost the same
fields. The author asked for one mechanism on both sides, no `dispose`, and no second format
between OHIF and the wire. The package under `packages/viewer-bridge` is not a bridge: it is the
OHIF-side application, the form's peer, and could be shipped as a separate application.

## Decision

1. **The channel package holds one end of the channel per window, created when its module
   loads.** `useChannel(options)` — the same `{ peerOrigin, accept, readyOn?, peerWindow? }` the
   former `createChannel` took — names the peer on the first mount, checks every later mount
   against it by value (a mismatch is logged as an error and ignored), leases the window
   `message` listener for the mount (attached with the first lease, removed with the last) and
   subscribes the calling component to `{ ready, queued }`. The public interface is
   `{ send, on, getState }`: `on(handler)` sets the one handler of this end and returns its
   detachment. No `createChannel`, `onMessage`, `dispose` or `subscribe` outside the package; `react`
   is a peer dependency of the channel and of the OHIF-side application.
2. **Both applications connect the same way.** The application hook — `useScoringForm(study)`
   in the form, `useScoringBridge(hostOrigin, ohif)` in the OHIF-side application — calls
   `useChannel`, registers `channel.on(handler)` in an effect whose cleanup detaches it, and
   returns the channel: the form's panel reads `channel.getState()` for its status line, the
   OHIF-side provider offers the channel through the context module's context.
3. **An action of the form is a command of the contract.** `FormAction` is the two local actions
   (`ADD_ROW`, `REMOVE_ROW`), every `HostCommand` and every `ViewerEvent`; the `dispatch` the hook
   returns sends every command through the channel and reduces everything. `ACTIVATE_TOOL` arms
   the row and `DEACTIVATE_TOOL` disarms it; the commands that change no row (`REMOVE_MEASUREMENT`,
   `FOCUS_MEASUREMENT`, `RESTORE_MEASUREMENTS`) and `VIEWER_READY` are explicit no-op cases.
   `VIEWER_READY` is answered inside the handler with the rows on screen: `restoreViewer(dispatch,
study, rows)` dispatches `RESTORE_MEASUREMENTS` and re-arms the drawing row.
4. **The OHIF-side application subscribes to OHIF the way it subscribes to the channel.**
   `createOhif(services, commandsManager)` (`ohif/facade.ts`) gives it `ohif.on(handler)`: one
   subscription over the five OHIF events, one unsubscribe. The facade is the boundary: the OHIF
   measurement object is parsed there once (`ohif/metrics.ts`), updates are throttled per uid
   there (100 ms, a removal drops the pending one), and what the handler receives is already in
   the contract's shape — `MEASUREMENT_ADDED` (with `rowId: null`), `MEASUREMENT_UPDATED`,
   `MEASUREMENT_REMOVED`, `VIEWER_READY` (on `VIEWPORT_ADDED`, and at once when a tool group
   already exists) — plus one internal `VIEWPORT_DATA_CHANGED`. `handleOhif` is one `switch`,
   the mirror of `handleCommand`, and adds only the application's state: the armed row on
   `MEASUREMENT_ADDED` (then the default tool), `VIEWER_READY` once per mount, the restore that
   waited for viewport data. The per-mount data is `{ channel, armedRowId, pendingRestore,
announced }`.
5. **Nothing is disposed.** The window listener is a lease released by the effect; OHIF
   subscriptions and the throttle's timers are released by `ohif.on`'s unsubscribe; the channel's
   queue and state live as long as the window.

## Why this way

The reader learns one sentence — `useChannel`, then `useEffect(() => x.on(handler))` — and finds
it on both sides and for both sources; every handler is the application's own `switch` over a
contract type; the boundary with OHIF is one file. The alternatives kept for the record: a map
of handlers resolved by the channel (rejected: the channel would read the message), a per-mount
channel with `dispose` (rejected: an unmount is not the end of the page), a third event format
between OHIF and the wire (rejected: two formats to learn for one stream).
