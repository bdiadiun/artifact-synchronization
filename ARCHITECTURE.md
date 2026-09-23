# Architecture

Two applications on different origins, one channel: `window.postMessage`.

```
host-app  http://localhost:5173                   viewer  http://localhost:3000 (OHIF fork)
┌──────────────────────────────┐                  ┌────────────────────────────────────┐
│ ScoringForm  rows[rowId]     │  ACTIVATE_TOOL   │ extension scoring-bridge           │
│ bridge client                │ ───────────────► │  context-module provider (React):  │
│  - origin check (viewer)     │  DEACTIVATE_TOOL │   window 'message' + origin check  │
│  - ready flag + FIFO queue   │ ◄─────────────── │   measurementService.subscribe     │
│  - rowId ↔ measurementUid    │  VIEWER_READY    │   commandsManager.run(setToolActive)│
│                              │  MEASUREMENT_*   │   uid ↔ rowId map                  │
└──────────────────────────────┘                  └────────────────────────────────────┘
        @bdiadiun/scoring-contract  (message schemas, zod), published to npm
              and depended on by both the host app and the viewer extension
```

## Message contract (version 1)

Source of truth: the published package `@bdiadiun/scoring-contract`, whose entry is
[`packages/contract/src/index.ts`](packages/contract/src/index.ts); the vocabulary, the host
commands and the viewer events each have their own module behind it. Every message is one zod
schema, and its TypeScript type is `z.infer` of the schema under the same name (A-26); the two
directions are discriminated unions on `type`. Every message carries `version: 1`, added by the
channel when it posts and checked by the channel before the contract guard runs (A-25); the guards
(`isHostCommand`, `isViewerEvent`, `safeParse` on the union) then reject unknown types and
malformed bodies. Unknown extra fields are ignored so a `version`
bump is needed only for breaking changes. Adding a message type (as the deletion bonus did) is
additive and stays in version 1: both sides are updated in the same slice, and an older peer would
simply reject the new type as unknown.

| Direction     | `type`                  | Payload (besides `version`, `type`)                                                                      | When                                                                                                                                                                                                                                                                                                                           |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| viewer → host | `VIEWER_READY`          | `viewerVersion: string`                                                                                  | First viewport added to a tool group, i.e. the earliest moment `setToolActive` works. Re-sent on iframe reload.                                                                                                                                                                                                                |
| host → viewer | `ACTIVATE_TOOL`         | `rowId`, `toolName: 'EllipticalROI' \| 'RectangleROI' \| 'Length'`                                       | "Activate" clicked in a row. Arms the bridge with `rowId`; a second one replaces the armed row.                                                                                                                                                                                                                                |
| host → viewer | `DEACTIVATE_TOOL`       | `rowId`                                                                                                  | Cancel clicked, or a drawing row removed. The viewer returns to its default tool if that row was armed (A-29).                                                                                                                                                                                                                 |
| viewer → host | `MEASUREMENT_ADDED`     | `rowId: string \| null`, `measurementUid`, `toolName`, `metrics: { area: { value, unit } }`, `geometry?` | Annotation completed. `rowId` is the armed row, `null` if nothing was armed; this is the one correlation (A-30).                                                                                                                                                                                                               |
| viewer → host | `MEASUREMENT_UPDATED`   | `measurementUid`, `toolName`, `metrics`                                                                  | Annotation modified. Throttled per uid to one event per 100 ms with a trailing emit, so the value at release always goes out; sent for every annotation, and the form ignores a uid it does not hold (A-23). It is also how a value that settled one render after `MEASUREMENT_ADDED` reaches the formr-pass lag. Bonus S-5.1. |
| host → viewer | `REMOVE_MEASUREMENT`    | `measurementUid`                                                                                         | "Видалити" on a row that has a measurement; the row is already gone from the form. Fire-and-forget: OHIF's own `MEASUREMENT_REMOVED` follows and the form ignores it (A-30). Bonus S-5.2.                                                                                                                                      |
| host → viewer | `FOCUS_MEASUREMENT`     | `measurementUid`                                                                                         | Click on a Done row. The viewer jumps to the annotation's image and selects it; unknown uid is ignored; nothing is sent back. Bonus S-5.3.                                                                                                                                                                                     |
| viewer → host | `MEASUREMENT_REMOVED`   | `measurementUid`                                                                                         | Annotation removed in OHIF, for any reason: a click in the viewer clears the matching row; the removal the form asked for reaches a row that is already gone and the reducer ignores it (A-30). Bonus S-5.2.                                                                                                                   |
| host → viewer | `RESTORE_MEASUREMENTS`  | `studyInstanceUid`, `measurements[]` (`rowId`, `measurementUid`, `toolName`, `geometry`)                 | On every `VIEWER_READY`, for the rows that hold a uid and a geometry (a page reload and a viewer reload alike). The viewer waits for viewport data and re-adds each annotation with its original uid. Bonus S-5.6.                                                                                                             |
| viewer → host | `MEASUREMENTS_RESTORED` | `restored[]` (row ids), `failed[]` (`rowId`, `reason`)                                                   | After a restore: the form marks each failed row. Reasons: `already-present`, `unknown-study`, `viewer-error`. Bonus S-5.6.                                                                                                                                                                                                     |

`metrics` is a partial record over the metric keys `'area' | 'length'` (A-28: a key outside the
vocabulary is refused); `unit` is `'mm2' | 'px2' | 'mm' | 'px'` and is copied from OHIF's
`cachedStats`, never inferred.
The measurement events also carry an optional `geometry` (frame of reference, referenced image and
handle points): the form persists it so the viewer can rebuild the annotation after a reload (A-14).

`ACTIVATE_TOOL.toolName` now carries the row's own tool (area rows: `EllipticalROI`; length rows:
`Length`) rather than always the configured default, so a length row arms the length tool on
activate and on re-arm after a viewer reload. Totals in the host-app footer are computed per
metric key (`area`, `length`) and per unit within that metric, never mixed across either axis
(S-5.4).

## Sequence: one measurement

```mermaid
sequenceDiagram
  participant U as Doctor
  participant H as host-app (5173)
  participant B as bridge client
  participant X as scoring-bridge extension (3000)
  participant O as OHIF services

  X->>O: provider mounts: subscribe MEASUREMENT_ADDED, VIEWPORT_ADDED
  O-->>X: VIEWPORT_ADDED (first viewport)
  X->>B: VIEWER_READY {viewerVersion}
  B->>B: ready = true, flush queue
  U->>H: "Додати вимірювання"
  H->>H: row {rowId: uuid, status: pending}
  U->>H: "Активувати"
  H->>B: ACTIVATE_TOOL {rowId, toolName}
  B->>X: postMessage(targetOrigin = viewer)
  X->>O: setToolActive(toolName)
  U->>O: draws ellipse
  O-->>X: MEASUREMENT_ADDED {uid, data.cachedStats}
  X->>X: metrics = toMetrics(); rowId = bridge.armedRowId (then cleared)
  X->>B: MEASUREMENT_ADDED {rowId, measurementUid, metrics, geometry}
  X->>O: setToolActive(WindowLevel)
  B->>H: MEASUREMENT_ADDED handler (onMessage)
  H->>H: row → done; totals recomputed
```

## Answers to the defence questions

See [`docs/DEFENCE.md`](docs/DEFENCE.md) for file and line pointers. In short: early commands are
queued in the host bridge client and flushed on `VIEWER_READY`; `postMessage` is the only channel
that crosses two origins with a verifiable sender; the viewer issues the measurement id and the
host the row id because OHIF rejects foreign fields on measurements; the subscription lives on
`measurementService` inside the bridge's effect, with the service OHIF hands the extension at
registration, because that is where the event is already de-duplicated; two tabs never interfere because each has its own
iframe window; the only place a loop could start is a host reaction to `MEASUREMENT_*`, and the form never
sends in reaction to an event: it only changes state (A-30).

## Decisions

Full records live in [`docs/decisions/`](docs/decisions/); the canon index is in
[`docs/CANON.md`](docs/CANON.md#decisions-on-ambiguities).

| Topic           | Decision                                                                                                                                                                                                                                                                                                                            | Record          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Who issues IDs  | Host issues `rowId` (UUID, before drawing); viewer issues `measurementUid` (cornerstone `annotationUID`). `MEASUREMENT_ADDED` carries both and the form stores the pair; every later event names the uid (A-30). No `requestId`.                                                                                                    | A-8             |
| Handshake       | The channel's `readyOn: 'VIEWER_READY'` (A-31): commands before it are queued and flushed in order, never dropped. Every `VIEWER_READY` (a viewer reload too) restores the rows that hold a geometry and re-arms the row in `Drawing…`.                                                                                             | A-9             |
| Early commands  | Queued (see above). Diagnosable on screen: the panel shows ready / queued count.                                                                                                                                                                                                                                                    | A-9             |
| Echo loop       | One rule per side (A-30): the form reacts to an event only by changing state, never by sending; the extension reacts to a command only by acting on OHIF, never by sending an event itself. The one reflection, `REMOVE_MEASUREMENT` → OHIF → `MEASUREMENT_REMOVED`, reaches a row that is already gone.                            | A-30            |
| Units           | Copied as is; totals computed per unit, mm² and px² never added.                                                                                                                                                                                                                                                                    | A-11            |
| Default tool    | After a measurement, a cancel or a page hide the viewer returns to `WindowLevel`, OHIF's default primary tool in this mode (A-23; the canon asks only that the tool deactivates).                                                                                                                                                   | A-8             |
| Ports / origins | 5173 and 3000, hardcoded in each app's config; `postMessage` always with an explicit `targetOrigin`.                                                                                                                                                                                                                                | A-2             |
| Repository      | Mono-repo with npm workspaces holding the form and the two published packages; the viewer is a separate application, cloned on demand at a pinned commit and not part of this repository.                                                                                                                                           | A-1, A-12, A-18 |
| OHIF base       | Fork branch `scoring` from release `v3.12.17`.                                                                                                                                                                                                                                                                                      | A-6             |
| Layers          | Contract (schemas) → channel (transport: origin, version, guard, `send`, `onMessage`, the queue until `readyOn`) → the two applications: the extension with one `switch` over the commands, the form with a reducer that takes the viewer's events as its actions. An event goes channel → `dispatch` → reducer (A-22, A-29, A-31). |
| Minimal bridge  | The viewer extension holds what is about OHIF and its own state: activating a tool, the armed row, reading `cachedStats`, rebuilding an annotation, announcing readiness once (A-23, A-29).                                                                                                                                         |
| Contract form   | Every message is one zod schema; its type is `z.infer` under the same name; the two directions are discriminated unions and the guards are `safeParse` (A-26). `zod` is the project's one library, used by the contract, the extension (OHIF's measurement object, A-28) and the form (stored rows).                                |
| Folder layout   | A folder names a side or a role: extension `commands/ events/ ohif/`, app the conventional `components/ pages/ hooks/ state/ services/ utils/`; no file under twenty lines; `.props.ts` only beside a React component (A-27).                                                                                                       |

## Where things are

| Concern                   | File                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewer side of the bridge | `packages/viewer-bridge/src/ScoringBridge.tsx` (the context-module provider OHIF mounts around the mode: reads the host origin, checks the cornerstone services), `bridge.ts` (the bridge as data: the channel, the armed row, a restore waiting for viewport data), `hooks/useScoringBridge.ts` (the lifecycle as effects over that data: the command handler, the subscriptions, the announcement — each cleaned up on unmount, A-32), `events/announce.ts` (`VIEWER_READY` at once if a viewport exists, else on the first `VIEWPORT_ADDED`), `commands/handlers.ts` (`handleCommand(ohif, bridge, command)`: one `switch` over the five commands), `commands/restore.ts` (S-5.6: re-adding annotations once the viewport holds data), `events/measurements.ts` (OHIF measurement → `metrics` and `geometry`, the three subscriptions), `ohif/surface.ts` (the OHIF surface we call, the version overlay), `ohif/throttle.ts` (A-27). The channel is transport only (A-29) |
| Extension registration    | `viewer/platform/app/pluginConfig.json` names one package, the adapter `@bdiadiun/ohif-extension-scoring-adapter`, which registers our extension itself through the extension manager (A-20); the bridge's provider is then mounted by every mode (A-32)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| The channel, used by both | The published package `@bdiadiun/scoring-channel` (A-31): one `createChannel({ peerOrigin, accept, readyOn?, peerWindow? })` for both ends — the origin check, the version, the contract guard (`accept`), `send` with an explicit target origin, one `onMessage` handler, and the queue that holds messages until `readyOn` arrives, flushed in order, observable as `{ ready, queued, announcements }`. The viewer names its peer window (`window.parent`); the host learns it from the source of the first accepted message, its `VIEWER_READY`. Two files: `channel.ts` and `peer.ts`                                                                                                                                                                                                                                                                                                                                                                                     |
| Host side of the bridge   | `host-app/src/hooks/useChannel.ts`: the page's one channel, `createChannel({ accept: isViewerEvent, readyOn: 'VIEWER_READY' })`, alive as long as the page (Q-5: what the hook subscribes, the hook unsubscribes; the channel has nothing outside the page to release, and the viewer is this page's iframe, so there is nothing left to deactivate). `useScoringForm` subscribes to it in an effect; `useChannel()` reads its `{ ready, queued }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Form state and actions    | `host-app/src/state/reducer.ts` (`Row`, the pure reducer whose actions are the four button actions and the viewer's events themselves), `state/selectors.ts` (the row lookups), `state/actions.ts` (what each button does to its row, called by the components, and `restoreViewer` — the stored rows and the drawing row offered to a viewer that has just announced itself), `hooks/useScoringForm.ts` (the form for one study: the reducer read from storage once and written back on every change, `channel.onMessage(dispatch)`, and the restore effect on every announcement), `services/channel.ts` (the page's one channel), `hooks/useChannel.ts` (its `{ ready, queued, announcements }`), `services/storage.ts` (A-14: the stored-row schema and one sessionStorage key per study, `getStorage` / `setStorage`, defensive), `utils/format.ts` (row status, kind and value)                                                                                         |
| Totals                    | `host-app/src/utils/totals.ts` (per-unit sums), `components/TotalsFooter.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tool to arm               | `host-app/src/config.ts` `DEFAULT_TOOL` (the one constant for the RectangleROI live change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Origins and study link    | `host-app/src/config.ts`: the origins, and the study resolved once per page load from the form's own `study` parameter with the previous constant as fallback (A-19); `packages/viewer-bridge/src/extension.ts` reads the host origin from the OHIF app config                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Contract release          | `.github/workflows/publish-contract.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Known behaviour

- Deliberate implementation details of the bridge (lifecycle, measurement filtering, command
  dispatch) are listed in [`docs/notes/bridge-internals.md`](docs/notes/bridge-internals.md).

- The area in `MEASUREMENT_ADDED` is read from cornerstone `cachedStats` at completion time. Those stats are filled in the render pass, so a release in the very same frame as the last mouse move (only reproducible with synthetic input) can carry a one-frame-old value; a human drag always dwells long enough. `MEASUREMENT_UPDATED` (bonus S-5.1) carries the settled value.
- Units: OHIF reports `mm²` when the image has pixel spacing and `px²` otherwise; a calibration suffix such as `mm² ERMF` is provenance and maps to `mm2`.

- The bridge disarms the viewer when it is disposed. It remembers that an `ACTIVATE_TOOL` was sent
  and posts one `DEACTIVATE_TOOL` on teardown when the viewer is ready and its window still exists,
  so a host unmount never leaves the ellipse tool armed on the other side (Q-5). Nothing is queued
  at that point: a viewer that was never ready has nothing armed.

- If a study never loads, no viewport is created and `VIEWER_READY` is never sent; queued commands
  stay queued and the status line keeps showing "очікує VIEWER_READY". A viewer without a viewport
  cannot accept tool commands, so this is the honest state.
- OHIF's measurement-tracking extension shows a "Track measurements for this series?" prompt on
  the first annotation. `MEASUREMENT_ADDED` is emitted regardless of the answer; the prompt is left
  as is (X-5).
