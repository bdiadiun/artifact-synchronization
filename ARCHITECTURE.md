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
bump is needed only for breaking changes.

| Direction | `type` | Payload (besides `version`, `type`) | When |
|---|---|---|---|
| viewer → host | `VIEWER_READY` | `viewerVersion: string` | First viewport added to a tool group, i.e. the earliest moment `setToolActive` works. Re-sent on iframe reload. |
| host → viewer | `ACTIVATE_TOOL` | `requestId`, `rowId`, `toolName: 'EllipticalROI' \| 'RectangleROI' \| 'Length'` | "Activate" clicked in a row. Arms the bridge with `rowId`. |
| host → viewer | `DEACTIVATE_TOOL` | `requestId`, `rowId` | Cancel clicked, or another row activated. Restores the previous tool. |
| viewer → host | `MEASUREMENT_ADDED` | `rowId: string \| null`, `measurementUid`, `toolName`, `metrics: { area: { value, unit } }`, `causedBy?` | Annotation completed. `rowId` is `null` if nothing was armed. |
| viewer → host | `MEASUREMENT_UPDATED` | `measurementUid`, `toolName`, `metrics`, `causedBy?` | Annotation modified (throttled). Bonus S-5.1. |

`unit` is `'mm2' | 'px2' | 'mm' | 'px'` and is copied from OHIF's `cachedStats`, never inferred.

## Decisions

Full records live in [`docs/decisions/`](docs/decisions/); the canon index is in
[`docs/CANON.md`](docs/CANON.md#decisions-on-ambiguities).

| Topic | Decision | Record |
|---|---|---|
| Who issues IDs | Host issues `rowId` (UUID, before drawing); viewer issues `measurementUid` (cornerstone `annotationUID`). OHIF rejects custom fields on measurements, so the bridge keeps a `uid ↔ rowId` map on both sides. | A-8 |
| Handshake | Host keeps `ready` + FIFO queue; commands before `VIEWER_READY` are queued and flushed in order, never dropped. A second `VIEWER_READY` (reload) re-arms the row in `Drawing…`. | A-9 |
| Early commands | Queued (see above). Diagnosable on screen: the panel shows ready / queued count. | A-9 |
| Echo loop | Mandatory part: host never writes back on `MEASUREMENT_*`, so no loop by construction. Bonus: `requestId` → `causedBy` and idempotent commands. | A-10 |
| Units | Copied as is; totals computed per unit, mm² and px² never added. | A-11 |
| Default tool | The bridge snapshots the active primary tool before arming and restores it afterwards (WindowLevel in the longitudinal mode, not Pan). | A-8 |
| Ports / origins | 5173 and 3000, hardcoded in each app's config; `postMessage` always with an explicit `targetOrigin`. | A-2 |
| Repository | Mono-repo with npm workspaces; the viewer is a submodule outside the workspaces with a checked copy of the contract. | A-1, A-12 |
| OHIF base | Fork branch `scoring` from release `v3.12.17`. | A-6 |

## Where things are

| Concern | File |
|---|---|
| Viewer side of the bridge | `viewer/extensions/scoring-bridge/src/bridge.ts` |
| Extension registration | `viewer/platform/app/pluginConfig.json` (`preRegistration` runs at app init for every listed extension, mode-independent) |
| Host side of the bridge | `host-app/src/bridge/createBridge.ts`, React binding `useBridge.ts` |
| Origins and study link | `host-app/src/config.ts`, `viewer/extensions/scoring-bridge/src/config.ts` |
| Contract sync check | `scripts/check-contract-sync.mjs` |

## Known behaviour

- If a study never loads, no viewport is created and `VIEWER_READY` is never sent; queued commands
  stay queued and the status line keeps showing "очікує VIEWER_READY". A viewer without a viewport
  cannot accept tool commands, so this is the honest state.
- OHIF's measurement-tracking extension shows a "Track measurements for this series?" prompt on
  the first annotation. `MEASUREMENT_ADDED` is emitted regardless of the answer; the prompt is left
  as is (X-5).
