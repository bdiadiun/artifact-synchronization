# A-32 — the bridge is a React layer, mounted by OHIF as a context module

Status: approved 2026-09-22. Canon: C-4.1, Q-1, Q-5, S-5.6. Related: [A-20](A-20-three-layers.md),
[A-23](A-23-minimal-bridge.md), [A-29](A-29-channel-is-transport.md), [A-31](A-31-one-channel.md).

## Context

The extension lived in `preRegistration`: plain functions, a hand-kept list of disposers and a
`pagehide` listener standing in for a component lifecycle. The host application, meanwhile, was a
React tree of hooks whose effects subscribe and unsubscribe by themselves. Two shapes for one job.

## Decision

- **The extension registers a context module.** OHIF composes every registered extension's
  `getContextModule()` provider around the mode it renders
  (`viewer/platform/app/src/routes/Mode/Mode.tsx`, `createCombinedContextProvider`), which is how
  its own measurement tracking gets an application-long React component. Ours is `ScoringBridge`:
  a provider that renders its children and runs `useScoringBridge(hostOrigin, services,
commandsManager)`.
- **`useScoringBridge` is the whole bridge lifecycle.** The bridge is data — `{ channel,
armedRowId, pendingRestore }` created once per mount (`bridge.ts`) — and every reaction is a
  plain function over `(ohif, bridge, …)`: `handleCommand`, `subscribeMeasurements`,
  `subscribeViewportData`, `announceOnViewport`. Each subscription is an effect whose cleanup
  unsubscribes (Q-5); the channel is disposed the same way. No `preRegistration`, no factories
  with a `dispose`, no disposer list, no `pagehide`. A `RESTORE_MEASUREMENTS` that arrives before
  the viewport holds data waits in `pendingRestore` for the next `VIEWPORT_DATA_CHANGED`.
- **The channel package offers one hook, `useChannelState(channel)`**, for the state the host
  shows; subscribing to messages is an effect written where it happens (`channel.onMessage` in
  the effect, its returned function as the cleanup), on both sides. `react >= 18` is a peer
  dependency of the channel and the bridge.
- **The announcement does not depend on effect order.** A provider's effects run after its
  children's, so a viewport may already exist when the bridge subscribes: `announceOnViewport`
  sends `VIEWER_READY` at once when a tool group exists and otherwise on the first
  `VIEWPORT_ADDED`. A mode remount (another study) mounts a new bridge and announces again.
- **Two Reacts are avoided at development time**: `npm run viewer:link` also links the viewer's
  `react` and `react-dom` into each linked package, because a symlinked package would otherwise
  resolve the repository's React 19 next to the viewer's React 18.

## Why this way

One rule for both applications — an effect subscribes, its cleanup unsubscribes — and the reviewer
finds every "cleanup" item of the assignment in the same idiom on both sides. The alternative, a
detached React root created in `preRegistration` just for effect cleanup, would have been React
without a mount point; the context module is OHIF's own way of giving an extension one.
