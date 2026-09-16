# OHIF bridge API note (v3.12.17)

Grounded reading of the OHIF source at tag `v3.12.17`. All paths are relative to the OHIF
repository root. Line numbers refer to that tag. Nothing in this note was executed; items marked
"runtime check" still need to be confirmed with the app running.

## 1. Extension anatomy and registration

An extension is a plain object; only `id` is required. Interface and hook params:

- `platform/core/src/extensions/ExtensionManager.ts:28` — `ExtensionParams` = `{ extensionManager, servicesManager, serviceProvidersManager, configuration?, peerImport }` plus `ExtensionConstructor`.
- `platform/core/src/extensions/ExtensionManager.ts:42-50` — `Extension { id; preRegistration?; getCommandsModule?; getViewportModule?; getUtilityModule?; ... }`.
- `platform/core/src/extensions/ExtensionManager.ts:276-285` — what is actually passed at call time:
  `servicesManager, serviceProvidersManager, commandsManager, hotkeysManager, extensionManager, appConfig, configuration`.

Template to copy: `extensions/test-extension/src/index.tsx:17-54` (`const testExtension: Types.Extensions.Extension = { id, preRegistration: ({ servicesManager }) => {...}, ... }`),
with the id in a separate `src/id.js`. An even smaller one is `extensions/dicom-pdf/src/index.tsx:20-45`.

Registration into the app: add the package name to `platform/app/pluginConfig.json` (`"extensions": [...]`,
lines 2-12; each entry `{ packageName, default?, version? }`), and the workspace glob `extensions/*`
in `package.json:11` picks it up. The mode must also list it.

Default `/viewer` route: `modes/longitudinal/src/index.ts:60` (`routeName: 'viewer'`), extensions come from
`modes/longitudinal/src/index.ts:20-24` (`extensionDependencies = { ...basicDependencies, '@ohif/extension-measurement-tracking': '^3.0.0' }`)
and are attached at `modes/longitudinal/src/index.ts:65` (`extensions: extensionDependencies`).
So the bridge package name must be added both to `pluginConfig.json` and to that `extensionDependencies` map.

## 2. measurementService

File: `platform/core/src/services/MeasurementService/MeasurementService.ts`.

`EVENTS` at `:71-84`:
`MEASUREMENT_UPDATED`, `INTERNAL_MEASUREMENT_UPDATED`, `MEASUREMENT_ADDED`, `RAW_MEASUREMENT_ADDED`,
`MEASUREMENT_REMOVED`, `MEASUREMENTS_CLEARED`, `JUMP_TO_MEASUREMENT`. Exposed as static and instance
`EVENTS` (`:128`, `super(EVENTS)` at `:139`).

`subscribe` comes from the pub/sub mixin: `platform/core/src/services/_shared/pubSubServiceInterface.ts:23-40`
— `subscribe(eventName, callback)` returns `{ unsubscribe: () => ... }`. That returned object is the only
cleanup handle (Q-5).

Payloads:
- ADDED — `{ source, measurement }` (`MeasurementService.ts:567-570`).
- UPDATED — `{ source, measurement, notYetUpdatedAtSource }` (`:559-564`, `:379-383`, `:872-876`).
- REMOVED — `{ source, measurement }` where `measurement` is the **UID string**, not the object (`:686-689`).

## 3. Measurement shape for EllipticalROI

`extensions/cornerstone/src/utils/measurementServiceMappings/EllipticalROI.ts:61-81` returns:
`uid` (= cornerstone `annotationUID`, line 62), `SOPInstanceUID`, `FrameOfReferenceUID`, `points`
(`data.handles.points`, line 53), `textBox`, `metadata` (the cornerstone annotation metadata object,
contains `toolName`, `referencedImageId`, `FrameOfReferenceUID` — line 29), `referencedImageId`,
`toolName`, `displaySetInstanceUID`, `label` (`data.label`), `displayText`, `data: data.cachedStats`,
`type`, `getReport`.

There is **no top-level `area`/`unit` field on the ellipse measurement.** Area lives inside
`measurement.data`, which is cornerstone's `cachedStats`, keyed per target (usually
`imageId:<referencedImageId>`), each holding `{ mean, stdDev, max, area, Modality, areaUnit, modalityUnit }`
— see the destructuring at `EllipticalROI.ts:110` and the display use at `:194,206-207`
(`${roundedArea} ${getDisplayUnit(areaUnit)}`). `getDisplayUnit` is a pass-through:
`extensions/cornerstone/src/utils/measurementServiceMappings/utils/getDisplayUnit.ts:1`.

So area is a **number** (`area`) plus a **unit string** (`areaUnit`). The unit string is produced by
cornerstone3D's calibrated-units helper when it computes `cachedStats`; OHIF only forwards it. Whether it
reads `mm²` or `px²` for a given series depends on pixel spacing and needs a runtime check (see §8).

`Length.ts:118` — `const { length, unit = 'mm' } = targetStats;` (note the `mm` default), `:125-126`.
`RectangleROI.ts:60-80` returns the same shape as the ellipse, also with `data: data.cachedStats`
carrying `area` / `areaUnit`.

## 4. When ADDED vs UPDATED actually fire

Wiring: `extensions/cornerstone/src/initMeasurementService.ts:332-342`
```
const addedEvt = csToolsEvents.ANNOTATION_ADDED;      // 332
const completedEvt = csToolsEvents.ANNOTATION_COMPLETED;
eventTarget.addEventListener(addedEvt, addMeasurement);      // 338
eventTarget.addEventListener(completedEvt, addMeasurement);  // 339
eventTarget.addEventListener(updatedEvt, updateMeasurement); // 340 (ANNOTATION_MODIFIED)
```
Both ADDED and COMPLETED call the same `addMeasurement` (`:225-259`), which forces
`annotationAddedEventDetail.uid = annotationUID` (`:253`) and calls `annotationToMeasurement(toolName, detail)`.

The de-duplication happens in the service, `MeasurementService.ts:545-576`: on the **first** call there is no
`oldMeasurement`, so it only logs `'Measurement started.'` and stores it — **no event is broadcast** (`:572-574`).
On the **second** call (ANNOTATION_COMPLETED, i.e. drawing finished) `oldMeasurement` exists and `isUpdate`
is false, so `MEASUREMENT_ADDED` is broadcast (`:567`). Net effect: the host sees `MEASUREMENT_ADDED` once,
on completion — exactly what C-4.3.5/C-4.3.6 need.

`updateMeasurement` (`initMeasurementService.ts:262-284`) fires on every `ANNOTATION_MODIFIED`, i.e. on each
drag frame, and bails out early if the measurement is not yet in the service (`:271-275`). It passes
`isUpdate = true`, so the service broadcasts `MEASUREMENT_UPDATED` with `notYetUpdatedAtSource: false`
(`:559-564`). For S-5.1 this stream must be throttled/debounced on our side.

## 5. Activating and deactivating a tool

Command `setToolActive`: `extensions/cornerstone/src/commandsModule.ts:1035-1068`, registered at `:2491-2493`.
Signature `{ toolName, toolGroupId = null, bindings = [{ mouseButton: Enums.MouseBindings.Primary }] }`.
It resolves the tool group via `toolGroupService.getToolGroup(toolGroupId)` (null → active viewport's group),
returns silently if the group does not exist or `!toolGroup.hasTool(toolName)` (`:1050-1055`), sets the
previously active primary tool to passive/disabled (`:1057-1063`) and then `toolGroup.setToolActive(toolName, { bindings })`.

There is also `setToolActiveToolbar({ toolName, toolGroupIds = [], ... })` at `:1025-1033`, which loops over
several tool groups — useful if we want all viewports armed.

Default primary tool in the longitudinal/basic mode: `modes/basic/src/initToolGroups.ts:21-35` puts
`WindowLevel` (primary mouse), `Pan` (auxiliary), `Zoom` (secondary), `StackScroll` (wheel) in `active`.
`EllipticalROI` is only `passive` (`:65`). So "return to default" for C-4.3.6 means
`setToolActive({ toolName: 'WindowLevel' })` — not `Pan`, which is on the middle button.

toolGroupService: `extensions/cornerstone/src/services/ToolGroupService/ToolGroupService.ts` —
`getToolGroup(toolGroupId?)` `:73`, `getToolGroupForViewport(viewportId)` `:108`,
`getActiveToolForViewport(viewportId)` `:113`, `getActivePrimaryMouseButtonTool(toolGroupId?)` `:242`.
The last one lets the bridge remember the pre-activation tool and restore it.

## 6. Correlating a measurement with an external ID

A custom top-level field does **not** survive: `MeasurementService.ts:832-841` (`_isValidMeasurement`) rejects
the whole measurement if any key is outside `MEASUREMENT_SCHEMA_KEYS` (`:33-69`), and that list is fixed
(`uid, color, data, getReport, displayText, ..., label, metadata, area, ..., isDirty`). The check runs on both
add and update paths (`:430`, `:526`).

Available carriers, in order of preference:
1. **`uid` = cornerstone `annotationUID`** (`EllipticalROI.ts:62`, forced in `initMeasurementService.ts:253`).
   Stable across ADDED/UPDATED/REMOVED and unique — the natural correlation key. The bridge keeps its own
   `rowId ↔ measurementUid` map in extension memory; the viewer issues the measurement UID, the host issues
   the row ID, and the bridge owns the mapping (Q-3).
2. **`label`** — a schema key, so it survives, but it is `data.label` from the cornerstone annotation and is
   user-visible/user-editable in the OHIF panel, so it is a fragile place for a machine ID.
3. **`metadata`** — passed through by reference from the cornerstone annotation (`EllipticalROI.ts:19,67`), so a
   field written onto `annotation.metadata` before mapping would reach the measurement. It is a cornerstone
   object, not ours; treat as a fallback only.

`update(measurementUID, measurement, notYetUpdatedAtSource = false)` at `:365-386` replaces the stored object and
re-broadcasts `MEASUREMENT_UPDATED` — this is the obvious echo-loop source (Q-4). `remove(measurementUID)` at
`:674-690` (S-5.2). Focus (S-5.3): `measurementService.jumpToMeasurement(viewportId, measurementUID)` at `:740-755`,
or the command `commandsManager.run('jumpToMeasurement', { uid })` — `commandsModule.ts:739-744`, registered `:2469`.
Read-back helpers: `getMeasurement(uid)` `:198`, `getMeasurements(filter?)` `:185`.

## 7. Existing postMessage / external hooks

None. A search over `platform/` and `extensions/` for `postMessage` returns no application code; the only
`addEventListener('message', ...)` hits are vendored bundles (`platform/app/public/oidc-client.min.js:1141`,
`platform/app/public/es6-shim.min.js:2039`) and the service worker (`platform/app/src/service-worker.js:49`).
There is no existing "external integration" extension — the bridge is greenfield, which also means no
naming collisions and no existing origin policy to respect.

## 8. App config and the study link

Config file: `platform/app/public/config/default.js`. `defaultDataSourceName: 'ohif'` (`:91`); that source is
`sourceName: 'ohif'` (`:105`) pointing at the public static WADO server
`https://d14fa38qiwhyfd.cloudfront.net/dicomweb` (`:109-111`, qido/wado/wadoUri all the same). No PACS needed (C-4.1.2, X-2).

`StudyInstanceUIDs` is read from the query string by the mode route:
`platform/app/src/routes/Mode/Mode.tsx:124` — `setStudyInstanceUIDs(dataSource.getStudyInstanceUIDs({ params, query }))`,
then provided at `:358`. So `/viewer?StudyInstanceUIDs=<uid>` opens a study directly (C-4.1.3).

Candidate study: `1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1`, used against the default data source by
several cypress specs — `platform/app/cypress/integration/MultiStudy.spec.js:4`,
`platform/app/cypress/integration/customization/HangingProtocol.spec.js:4,32-33`,
`platform/app/cypress/integration/study-list/OHIFStudyList.spec.js:46`. It is the standard OHIF demo study and is
known to render measurements in the e2e suite. **Whether its pixel spacing yields `mm²` is a runtime check** —
open the study, draw one ellipse and read `cachedStats[...].areaUnit`.

## 9. Toolchain

- Engines: `package.json:23-27` — `node >= 18`, `npm >= 6`, `yarn >= 1.20.0`. No `.nvmrc`, no `.yarnrc` in the repo.
- Root dev: `package.json` `"dev": "lerna run dev:viewer --stream"` and `"start": "yarn run dev"`.
- App dev: `platform/app/package.json:37` `"dev:viewer": "yarn run dev"` → `:31`
  `"dev": "cross-env NODE_ENV=development webpack serve --config .webpack/webpack.pwa.js"`.
- Port: `platform/app/.webpack/webpack.pwa.js:29` — `const OHIF_PORT = Number(process.env.OHIF_PORT || 3000);`,
  applied at `:152` (`port: OHIF_PORT`). So the viewer is on `http://localhost:3000` by default and the port is
  overridable via the `OHIF_PORT` env var — matching decision A-2.

## Design implications

- **The viewer issues the measurement ID, not the host.** `measurement.uid` is forced to the cornerstone
  `annotationUID` (`initMeasurementService.ts:253`), and the schema whitelist (`MeasurementService.ts:832-841`)
  blocks any custom field, so the host cannot stamp its own ID onto a measurement. The host issues the row ID,
  the bridge holds a `rowId ↔ measurementUid` map and translates in both directions.
- **Subscribe in `preRegistration`, on `measurementService`, not on cornerstone events.** The service already
  de-duplicates the two cornerstone events into one `MEASUREMENT_ADDED`, and `subscribe` hands back an
  `unsubscribe` closure that satisfies Q-5.
- **Drawing completion is free.** `MEASUREMENT_ADDED` is broadcast only on `ANNOTATION_COMPLETED`, because the
  `ANNOTATION_ADDED` pass stores the measurement without broadcasting (`MeasurementService.ts:572-574`). No
  debouncing needed to distinguish "started drawing" from "finished".
- **`MEASUREMENT_UPDATED` is a firehose** — one event per `ANNOTATION_MODIFIED`, i.e. per drag frame. S-5.1 needs
  throttling on the viewer side, and the echo guard must compare values, not just track a "we sent this" flag.
- **Area is `data[targetId].area` + `data[targetId].areaUnit`, never a top-level `area`.** The bridge must pick a
  target key (normally `imageId:${referencedImageId}`) and ship `{ value, unit }` as one inseparable pair, so the
  host can refuse to sum `mm²` with `px²` (Q-6). Length uses `length` + `unit` (defaulting to `'mm'`).
- **Deactivation means re-activating `WindowLevel`**, the default primary-mouse tool in the basic/longitudinal
  tool group (`modes/basic/src/initToolGroups.ts:21-24`) — "Pan" in the assignment text is loose wording. Better
  still, snapshot `toolGroupService.getActivePrimaryMouseButtonTool()` before arming and restore that.
- **Tool name is pure data.** `setToolActive({ toolName })` validates with `toolGroup.hasTool(toolName)` and
  `EllipticalROI`, `RectangleROI` and `Length` are all registered as passive tools in the same group, so the
  P-7 live change (ellipse → rectangle) is a payload change only.
- **No existing postMessage surface in OHIF**, so the bridge defines the whole protocol and must add its own
  origin check (Q-2); nothing in the app will compete for `window.message`.
