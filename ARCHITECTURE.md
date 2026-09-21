# Architecture

Two applications on different origins, one channel: `window.postMessage`.

```
host-app  http://localhost:5173                   viewer  http://localhost:3000 (OHIF fork)
┌──────────────────────────────┐                  ┌────────────────────────────────────┐
│ ScoringForm  rows[rowId]     │  ACTIVATE_TOOL   │ extension scoring-bridge           │
│ bridge client                │ ───────────────► │  preRegistration:                  │
│  - origin check (viewer)     │  DEACTIVATE_TOOL │   window 'message' + origin check  │
│  - ready flag + FIFO queue   │ ◄─────────────── │   measurementService.subscribe     │
│  - rowId ↔ measurementUid    │  VIEWER_READY    │   commandsManager.run(setToolActive)│
│                              │  MEASUREMENT_*   │   uid ↔ rowId map                  │
└──────────────────────────────┘                  └────────────────────────────────────┘
        @bdiadiun/scoring-contract  (types + guards, version: 1), published to npm
              and depended on by both the host app and the viewer extension
```

## Message contract (version 1)

Source of truth: the published package `@bdiadiun/scoring-contract`, whose entry is
[`packages/contract/src/index.ts`](packages/contract/src/index.ts); the vocabulary, the host
commands, the viewer events and the primitive guards each have their own module behind it.
Every message carries `version: 1`; receivers reject other versions and unknown types with a
runtime guard (`isHostCommand`, `isViewerEvent`). Unknown extra fields are ignored so a `version`
bump is needed only for breaking changes. Adding a message type (as the deletion bonus did) is
additive and stays in version 1: both sides are updated in the same slice, and an older peer would
simply reject the new type as unknown.

| Direction     | `type`                  | Payload (besides `version`, `type`)                                                                      | When                                                                                                                                                                                                                                                                                         |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| viewer → host | `VIEWER_READY`          | `viewerVersion: string`                                                                                  | First viewport added to a tool group, i.e. the earliest moment `setToolActive` works. Re-sent on iframe reload.                                                                                                                                                                              |
| host → viewer | `ACTIVATE_TOOL`         | `requestId`, `rowId`, `toolName: 'EllipticalROI' \| 'RectangleROI' \| 'Length'`                          | "Activate" clicked in a row. Arms the bridge with `rowId`.                                                                                                                                                                                                                                   |
| host → viewer | `DEACTIVATE_TOOL`       | `requestId`, `rowId`                                                                                     | Cancel clicked, or another row activated. Restores the previous tool.                                                                                                                                                                                                                        |
| viewer → host | `MEASUREMENT_ADDED`     | `rowId: string \| null`, `measurementUid`, `toolName`, `metrics: { area: { value, unit } }`, `causedBy?` | Annotation completed. `rowId` is `null` if nothing was armed.                                                                                                                                                                                                                                |
| viewer → host | `MEASUREMENT_UPDATED`   | `measurementUid`, `toolName`, `metrics`                                                                  | Annotation modified. Throttled per uid to one event per 100 ms with a trailing emit, only for measurements bound to a row, skipped when the value did not change. A one-shot correction 150 ms after `MEASUREMENT_ADDED` covers the `cachedStats` render-pass lag. Bonus S-5.1.              |
| host → viewer | `REMOVE_MEASUREMENT`    | `requestId`, `rowId`, `measurementUid`                                                                   | "Видалити" on a row that has a measurement. Idempotent: a uid the viewer no longer holds is still answered with `MEASUREMENT_REMOVED`, so the host never waits for an echo that cannot come. Bonus S-5.2.                                                                                    |
| host → viewer | `FOCUS_MEASUREMENT`     | `requestId`, `rowId`, `measurementUid`                                                                   | Click on a Done row. The viewer jumps to the annotation's image and selects it; unknown uid is ignored; nothing is sent back. Bonus S-5.3.                                                                                                                                                   |
| viewer → host | `MEASUREMENT_REMOVED`   | `measurementUid`, `causedBy?`                                                                            | Annotation removed in OHIF, for any reason. `causedBy` carries the `requestId` of the `REMOVE_MEASUREMENT` that caused it. An answer is delivered to the exchange that asked for it and never reaches the general handlers, which is what keeps an echo out of the form (A-21). Bonus S-5.2. |
| host → viewer | `RESTORE_MEASUREMENTS`  | `requestId`, `studyInstanceUid`, `measurements[]` (`rowId`, `measurementUid`, `toolName`, `geometry`)    | After a reload, when the form has stored rows for this study. The viewer waits for viewport data, re-adds each annotation with its original uid and answers once. Bonus S-5.6.                                                                                                               |
| viewer → host | `MEASUREMENTS_RESTORED` | `causedBy?`, `restored[]` (row ids), `failed[]` (`rowId`, `reason`)                                      | Answer to the restore command, delivered to the exchange that sent it; an answer that never arrives is reported rather than waited for. Reasons: `already-present`, `unknown-study`, `invalid-geometry`, `viewer-error`. Bonus S-5.6.                                                        |

`unit` is `'mm2' | 'px2' | 'mm' | 'px'` and is copied from OHIF's `cachedStats`, never inferred.
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

  X->>O: preRegistration: subscribe MEASUREMENT_ADDED, VIEWPORT_ADDED
  O-->>X: VIEWPORT_ADDED (first viewport)
  X->>B: VIEWER_READY {viewerVersion}
  B->>B: ready = true, flush queue
  U->>H: "Додати вимірювання"
  H->>H: row {rowId: uuid, status: pending}
  U->>H: "Активувати"
  H->>B: ACTIVATE_TOOL {requestId, rowId, toolName}
  B->>X: postMessage(targetOrigin = viewer)
  X->>O: snapshot active tool; setToolActive(toolName)
  U->>O: draws ellipse
  O-->>X: MEASUREMENT_ADDED {uid, data.cachedStats}
  X->>X: metrics = toMetrics(); uidToRowId.set(uid, rowId)
  X->>B: MEASUREMENT_ADDED {rowId, measurementUid, metrics, causedBy}
  X->>O: restore previous tool; disarm
  B->>H: lastEvent
  H->>H: row → done; totals recomputed
```

## Answers to the defence questions

See [`docs/DEFENCE.md`](docs/DEFENCE.md) for file and line pointers. In short: early commands are
queued in the host bridge client and flushed on `VIEWER_READY`; `postMessage` is the only channel
that crosses two origins with a verifiable sender; the viewer issues the measurement id and the
host the row id because OHIF rejects foreign fields on measurements; the subscription lives on
`measurementService` inside `preRegistration` because that is where OHIF hands out the service and
where the event is already de-duplicated; two tabs never interfere because each has its own
iframe window; the only place a loop could start is a host reaction to `MEASUREMENT_*`, which the
mandatory part does not have and the bonus part guards with `causedBy`.

## Decisions

Full records live in [`docs/decisions/`](docs/decisions/); the canon index is in
[`docs/CANON.md`](docs/CANON.md#decisions-on-ambiguities).

| Topic           | Decision                                                                                                                                                                                                                                                                                                                                                   | Record          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Who issues IDs  | Host issues `rowId` (UUID, before drawing); viewer issues `measurementUid` (cornerstone `annotationUID`). OHIF rejects custom fields on measurements, so the bridge keeps a `uid ↔ rowId` map on both sides.                                                                                                                                               | A-8             |
| Handshake       | Host keeps `ready` + FIFO queue; commands before `VIEWER_READY` are queued and flushed in order, never dropped. A second `VIEWER_READY` (reload) re-arms the row in `Drawing…`.                                                                                                                                                                            | A-9             |
| Early commands  | Queued (see above). Diagnosable on screen: the panel shows ready / queued count.                                                                                                                                                                                                                                                                           | A-9             |
| Echo loop       | The host never sends a command in reaction to a `MEASUREMENT_*` event (enforced by tests on the form hook), and the bridge never calls `measurementService.update()`, so the only re-broadcast point in OHIF is never triggered by us. `requestId` → `causedBy` and idempotent commands are the guard for commands that do mutate measurements (deletion). | A-10            |
| Units           | Copied as is; totals computed per unit, mm² and px² never added.                                                                                                                                                                                                                                                                                           | A-11            |
| Default tool    | The bridge snapshots the active primary tool before arming and restores it afterwards (WindowLevel in the longitudinal mode, not Pan).                                                                                                                                                                                                                     | A-8             |
| Ports / origins | 5173 and 3000, hardcoded in each app's config; `postMessage` always with an explicit `targetOrigin`.                                                                                                                                                                                                                                                       | A-2             |
| Repository      | Mono-repo with npm workspaces holding the form and the two published packages; the viewer is a separate application, cloned on demand at a pinned commit and not part of this repository.                                                                                                                                                                  | A-1, A-12, A-18 |
| OHIF base       | Fork branch `scoring` from release `v3.12.17`.                                                                                                                                                                                                                                                                                                             | A-6             |

## Where things are

| Concern                   | File                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewer side of the bridge | `packages/viewer-bridge/src/bridge.ts` (composition root), `messaging.ts` (the channel's ends, twenty lines), `registry.ts` (the handler registry every command goes through), `handshake.ts` (`VIEWER_READY`), `measurementStream.ts` (the three subscriptions), `reportedMeasurements.ts` (`uid ↔ rowId`, throttled updates), `commands.ts` (arming and tool control), `removals.ts`, `focus.ts`, `measurements.ts`, `throttle.ts`, `getCustomizationModule.tsx`, `restore.ts` (RESTORE_MEASUREMENTS, readiness gate, re-adding annotations), `geometry.ts` |
| Extension registration    | `viewer/platform/app/pluginConfig.json` names one package, the adapter `@bdiadiun/ohif-extension-scoring-adapter`, which registers our extensions itself through the extension manager (A-20) (`preRegistration` runs at app init for every listed extension, mode-independent)                                                                                                                                                                                                                                                                               |
| The channel, used by both | The published package `@bdiadiun/scoring-channel` (A-21): the origin check, the contract guard, posting with an explicit target origin, and `send`, `on` and `exchange` typed from the message type. It fills in `version` and the request id, and rejects an exchange whose answer never arrives                                                                                                                                                                                                                                                             |
| Host side of the bridge   | The published package `@bdiadiun/scoring-orchestrator` (A-17): what is the host's own, the queue that holds commands until `VIEWER_READY`, the armed-tool memory, the listener set and teardown. The React binding `host-app/src/hooks/useBridge.ts` stays in the form                                                                                                                                                                                                                                                                                        |
| Form rows and commands    | `host-app/src/form/rows.ts` (pure reducer delegating to one helper per action), `selectors.ts`, `commands.ts` (command builders), `useScoringForm.ts` (row ids, user actions), `useViewerEvents.ts` and `viewerEventHandlers.ts` (incoming events), `format.ts` (row status, kind and value)                                                                                                                                                                                                                                                                  |
| Totals                    | `host-app/src/form/totals.ts` (per-unit sums), `components/TotalsFooter.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tool to arm               | `host-app/src/config.ts` `DEFAULT_TOOL` (the one constant for the RectangleROI live change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Origins and study link    | `host-app/src/config.ts`: the origins, and the study resolved once per page load from the form's own `study` parameter with the previous constant as fallback (A-19); `packages/viewer-bridge/src/config.ts`                                                                                                                                                                                                                                                                                                                                                  |
| Contract release          | `.github/workflows/publish-contract.yml`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

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
