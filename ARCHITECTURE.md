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
              packages/contract/src/messages.ts  (types + guards, version: 1)
              byte-identical copy: viewer/extensions/scoring-bridge/src/contract/messages.ts
```

## Message contract (version 1)

Source of truth: [`packages/contract/src/messages.ts`](packages/contract/src/messages.ts).
Every message carries `version: 1`; receivers reject other versions and unknown types with a
runtime guard (`isHostCommand`, `isViewerEvent`). Unknown extra fields are ignored so a `version`
bump is needed only for breaking changes. Adding a message type (as the deletion bonus did) is
additive and stays in version 1: both sides are updated in the same slice, and an older peer would
simply reject the new type as unknown.

| Direction | `type` | Payload (besides `version`, `type`) | When |
|---|---|---|---|
| viewer → host | `VIEWER_READY` | `viewerVersion: string` | First viewport added to a tool group, i.e. the earliest moment `setToolActive` works. Re-sent on iframe reload. |
| host → viewer | `ACTIVATE_TOOL` | `requestId`, `rowId`, `toolName: 'EllipticalROI' \| 'RectangleROI' \| 'Length'` | "Activate" clicked in a row. Arms the bridge with `rowId`. |
| host → viewer | `DEACTIVATE_TOOL` | `requestId`, `rowId` | Cancel clicked, or another row activated. Restores the previous tool. |
| viewer → host | `MEASUREMENT_ADDED` | `rowId: string \| null`, `measurementUid`, `toolName`, `metrics: { area: { value, unit } }`, `causedBy?` | Annotation completed. `rowId` is `null` if nothing was armed. |
| viewer → host | `MEASUREMENT_UPDATED` | `measurementUid`, `toolName`, `metrics` | Annotation modified. Throttled per uid to one event per 100 ms with a trailing emit, only for measurements bound to a row, skipped when the value did not change. A one-shot correction 150 ms after `MEASUREMENT_ADDED` covers the `cachedStats` render-pass lag. Bonus S-5.1. |
| host → viewer | `REMOVE_MEASUREMENT` | `requestId`, `rowId`, `measurementUid` | "Видалити" on a row that has a measurement. Idempotent: an unknown uid is ignored. Bonus S-5.2. |
| viewer → host | `MEASUREMENT_REMOVED` | `measurementUid`, `causedBy?` | Annotation removed in OHIF, for any reason. `causedBy` carries the `requestId` of the `REMOVE_MEASUREMENT` that caused it, so the host can tell its own echo from a deletion made in the viewer. Bonus S-5.2. |

`unit` is `'mm2' | 'px2' | 'mm' | 'px'` and is copied from OHIF's `cachedStats`, never inferred.

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

| Topic | Decision | Record |
|---|---|---|
| Who issues IDs | Host issues `rowId` (UUID, before drawing); viewer issues `measurementUid` (cornerstone `annotationUID`). OHIF rejects custom fields on measurements, so the bridge keeps a `uid ↔ rowId` map on both sides. | A-8 |
| Handshake | Host keeps `ready` + FIFO queue; commands before `VIEWER_READY` are queued and flushed in order, never dropped. A second `VIEWER_READY` (reload) re-arms the row in `Drawing…`. | A-9 |
| Early commands | Queued (see above). Diagnosable on screen: the panel shows ready / queued count. | A-9 |
| Echo loop | The host never sends a command in reaction to a `MEASUREMENT_*` event (enforced by tests on the form hook), and the bridge never calls `measurementService.update()`, so the only re-broadcast point in OHIF is never triggered by us. `requestId` → `causedBy` and idempotent commands are the guard for commands that do mutate measurements (deletion). | A-10 |
| Units | Copied as is; totals computed per unit, mm² and px² never added. | A-11 |
| Default tool | The bridge snapshots the active primary tool before arming and restores it afterwards (WindowLevel in the longitudinal mode, not Pan). | A-8 |
| Ports / origins | 5173 and 3000, hardcoded in each app's config; `postMessage` always with an explicit `targetOrigin`. | A-2 |
| Repository | Mono-repo with npm workspaces; the viewer is a submodule outside the workspaces with a checked copy of the contract. | A-1, A-12 |
| OHIF base | Fork branch `scoring` from release `v3.12.17`. | A-6 |

## Where things are

| Concern | File |
|---|---|
| Viewer side of the bridge | `viewer/extensions/scoring-bridge/src/bridge.ts` (listener, handshake, subscriptions, outgoing `MEASUREMENT_ADDED` / `MEASUREMENT_UPDATED`, `uid ↔ rowId` map), `commands.ts` (ACTIVATE/DEACTIVATE, armed state, previous-tool restore), `measurements.ts` (OHIF measurement → `metrics`; add a metric here for P-8), `throttle.ts` (per-key throttled emitter), `removals.ts` (REMOVE_MEASUREMENT, pending-removal `causedBy` map), `getCustomizationModule.tsx` (OHIF version overlay on every viewport, bonus S-5.5) |
| Extension registration | `viewer/platform/app/pluginConfig.json` (`preRegistration` runs at app init for every listed extension, mode-independent) |
| Host side of the bridge | `host-app/src/bridge/createBridge.ts`, React binding `useBridge.ts` |
| Form rows and commands | `host-app/src/form/rows.ts` (pure reducer), `useScoringForm.ts` (row IDs, activate/cancel, re-arm on reload, measurement intake) |
| Totals | `host-app/src/form/totals.ts` (per-unit sums), `components/TotalsFooter.tsx` |
| Tool to arm | `host-app/src/config.ts` `DEFAULT_TOOL` (the one constant for the RectangleROI live change) |
| Origins and study link | `host-app/src/config.ts`, `viewer/extensions/scoring-bridge/src/config.ts` |
| Contract sync check | `scripts/check-contract-sync.mjs` |

## Known behaviour

- The area in `MEASUREMENT_ADDED` is read from cornerstone `cachedStats` at completion time. Those stats are filled in the render pass, so a release in the very same frame as the last mouse move (only reproducible with synthetic input) can carry a one-frame-old value; a human drag always dwells long enough. `MEASUREMENT_UPDATED` (bonus S-5.1) carries the settled value.
- Units: OHIF reports `mm²` when the image has pixel spacing and `px²` otherwise; a calibration suffix such as `mm² ERMF` is provenance and maps to `mm2`.

- If a study never loads, no viewport is created and `VIEWER_READY` is never sent; queued commands
  stay queued and the status line keeps showing "очікує VIEWER_READY". A viewer without a viewport
  cannot accept tool commands, so this is the honest state.
- OHIF's measurement-tracking extension shows a "Track measurements for this series?" prompt on
  the first annotation. `MEASUREMENT_ADDED` is emitted regardless of the answer; the prompt is left
  as is (X-5).
