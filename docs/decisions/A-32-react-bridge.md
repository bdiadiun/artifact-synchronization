# A-32 — the bridge is a React layer, mounted by OHIF as a context module

Status: approved 2026-09-22, amended 2026-09-23 by [A-33](A-33-review-of-the-boundaries-refactor.md)
and [A-34](A-34-two-applications-one-channel-hook.md) (the hook's shape, the channel binding).
Canon: C-3.4, C-4.1, Q-1, Q-5, S-5.6. Related: [A-20](A-20-three-layers.md),
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
  a provider defined inside `getContextModule` that runs `useScoringBridge(hostOrigin, ohif)` and
  offers the channel it returns through the module's context, where `ohif` is
  `createOhif(services, commandsManager)` built from the getter's parameters (A-34).
- **C-3.4 is met through the module getter, not `preRegistration`.** The canon's sentence
  ("obtains `servicesManager` and `commandsManager` in the `preRegistration` hook") names the
  place OHIF hands an extension its services; `getContextModule` receives the same parameters
  (`ExtensionManager.ts:463-469`) and, unlike `preRegistration`, gives the extension a mount point
  whose unmount is a cleanup. The bridge still lives inside our extension, subscribes to
  `measurementService` and calls `commandsManager.runCommand(...)`; the adapter that registers it
  keeps using `preRegistration` (A-20). Recorded in the canon as A-33.
- **`useScoringBridge` is the whole lifecycle of the OHIF-side application.** Its per-mount data
  is `{ channel, armedRowId, pendingRestore, announced }` (`bridge.ts`), and every reaction is a
  plain function over `(ohif, bridge, …)`: `handleCommand` for the channel, `handleOhif` for
  OHIF. The hook takes the channel from `useChannel`, registers the two handlers in two effects
  whose cleanups detach them, and returns the channel for the provider to offer through the
  context (A-34, 2026-09-23; the first version created a channel per mount in a `useState`
  initializer and disposed it in a separate effect, the second created and disposed it in one
  effect — both replaced by the module-level end of A-34). No `preRegistration`, no `dispose`, no
  disposer list, no `pagehide`. A `RESTORE_MEASUREMENTS` that arrives before the viewport holds
  data waits in `pendingRestore` for the next `VIEWPORT_DATA_CHANGED`.
- **A viewer opened on its own has no peer.** `createBridge` passes `window.parent` as the
  channel's peer window only when the viewer is embedded (`window.parent !== window`); a
  standalone viewer queues its events instead of posting them to itself with a target origin the
  browser refuses (amended 2026-09-23).
- **The channel package owns the one React binding, `useChannel`** (A-34, 2026-09-23). Subscribing
  to messages is an effect written where it happens (`channel.on` in the effect, its returned
  function as the cleanup), on both sides; `useChannel` itself subscribes the component to
  `{ ready, queued }`, which the form's panel reads with `channel.getState()`. `react` is a peer
  dependency of the channel and of the OHIF-side application. (This bullet said "one hook,
  `useChannelState`" on 2026-09-22 and "React-free" for a few hours on 2026-09-23.)
- **The announcement does not depend on effect order.** A provider's effects run after its
  children's, so a viewport may already exist when the application subscribes: `ohif.on` delivers
  `VIEWER_READY` at once when a tool group exists and on every `VIEWPORT_ADDED`, and `handleOhif`
  sends it once per mount (`bridge.announced`). A mode remount (another study) mounts new
  per-mount data and announces again through the same channel.
- **One React at development time needs no extra links.** The fork's webpack resolves modules
  from a fixed list of absolute directories (`viewer/.webpack/webpack.base.js`, `resolve.modules`),
  so a symlinked package's `react` already resolves to the viewer's copy; `npm run viewer:link`
  links our four packages and nothing else (amended 2026-09-23; the first version also linked
  `react` and `react-dom` into `packages/*/node_modules`, where the host application's resolver
  found them before its own React 19 and ran two Reacts).

## Why this way

One rule for both applications — an effect subscribes, its cleanup unsubscribes — and the reviewer
finds every "cleanup" item of the assignment in the same idiom on both sides. The alternative, a
detached React root created in `preRegistration` just for effect cleanup, would have been React
without a mount point; the context module is OHIF's own way of giving an extension one.
