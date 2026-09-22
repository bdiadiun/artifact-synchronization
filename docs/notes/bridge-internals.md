# Bridge internals

Implementation details of the bridge that are deliberate but not visible from the code alone.
Decisions live in [`docs/decisions/`](../decisions/); OHIF behaviour we rely on is in
[`ohif-bridge-api.md`](ohif-bridge-api.md). File names below refer to
`packages/viewer-bridge/src/` unless a path is given. The extension is six modules, laid out by
role (A-27): `extension.ts` (composition root, announces `VIEWER_READY` once), `commands/handlers.ts`
(one `switch` over the commands, the armed row), `commands/restore.ts`, `events/measurements.ts`,
`ohif/surface.ts` and `ohif/throttle.ts`. The channel is transport only (A-29, A-31).

## Lifecycle

- **Disposed on `pagehide`, not `onModeExit`** (`extension.ts`). The bridge must outlive OHIF mode
  changes, because the host keeps talking to the same iframe, and extensions have no unregister
  hook. The page lifetime is the only correct scope.
- **`dispose()` returns to the default tool first** (`extension.ts`). `WindowLevel` is activated
  before the listeners and subscriptions go away, so closing the viewer never leaves the ellipse
  tool armed (A-23: no snapshot of the previous tool any more).
- **The OHIF services are required, not optional** (A-28, `ohif-service-availability.md`). The
  three core services exist before any extension runs; `toolGroupService` and
  `cornerstoneViewportService` are registered by `@ohif/extension-cornerstone`, which
  `pluginConfig.json` lists before our adapter. `extension.ts` checks the two cornerstone services
  once at `preRegistration` and refuses to start without them; no other "service unavailable"
  branch exists.
- **OHIF's measurement object is parsed once** by the `OhifMeasurement` schema in `ohif/surface.ts`
  when a measurement event arrives; `toMetrics` and `toGeometry` work on the parsed value. An event
  whose payload is not a measurement (a bare uid string, no uid) is ignored with one warning.

## Measurements

- **Stats lookup** (`events/measurements.ts`). `measurement.data` is keyed by target; the entry
  `imageId:<referencedImageId>` is preferred, otherwise the first entry with a finite value.
- **No metrics on `MEASUREMENT_ADDED` means nothing is posted** (`events/measurements.ts`). A half-formed event
  would move the row to `Готово` without a value; staying silent leaves it in `Малювання…` where
  the doctor can cancel or redraw.
- **`MEASUREMENT_UPDATED` goes out for every annotation** (`events/measurements.ts`), throttled per uid;
  the form ignores a uid no row holds, so the extension keeps no `uid → rowId` map (A-23).
- **Silent mapping during drags** (`events/measurements.ts`). On the update path a measurement without
  stats is skipped without a log: cornerstone fills `cachedStats` in its render pass, so
  intermediate drag frames without stats are normal.

## Commands

- **Every command goes through one `switch`** (`commands/handlers.ts`, registered with
  `channel.onMessage`, `default` narrowing to `never`): a command added to the contract without a
  case fails the type check, and an unknown type never reaches the switch because the contract
  guard rejects it on arrival.
- **A removal is fire-and-forget** (A-30): the handler calls `measurementService.remove` when the
  uid is present and sends nothing itself; OHIF's `MEASUREMENT_REMOVED` reaches the host through
  the subscription, for a row that is already gone.

## Host side

- **No separate `uid → rowId` map on the host** (`host-app/src/form/useScoringForm.ts`). A `done`
  row stores its own `measurementUid`, and `MEASUREMENT_ADDED` carries `rowId`, so the rows array
  is the map. The viewer keeps no map either: `commands/handlers.ts` remembers only the armed
  `rowId` (A-29), which the next `MEASUREMENT_ADDED` takes.

## Details moved out of the code (A-24)

- **Announce once** (`extension.ts`): the first `VIEWPORT_ADDED` unsubscribes and sends
  `VIEWER_READY`; a viewer reload starts a new extension instance, which announces again.
- **Removal goes through OHIF** (`commands/handlers.ts`): `measurementService.remove` (the
  `removeMeasurement` command only wraps that call, `commandsModule.ts:746-751`) fires OHIF's
  `MEASUREMENT_REMOVED`, which the subscription in `events/measurements.ts` forwards.
- **Focus** (`commands/handlers.ts`): cornerstone's `JUMP_TO_MEASUREMENT` handler selects the annotation and
  moves the camera (`commandsModule.ts:208-241`); an unknown uid is an ordinary race, not an error.
- **Restore is hand-built** (`commands/restore.ts`): `EllipticalROITool.hydrate` re-derives metadata from the
  live camera, needs an enabled element and drops the label; `activeHandleIndex` must be `null`,
  not absent, or the renderer indexes canvas coordinates with `undefined`
  (`EllipticalROITool.js:445`); the group key for `addAnnotation` comes from
  `metadata.FrameOfReferenceUID` for any string selector (`annotationState.js:59-68`); the viewport
  holds data only after `VIEWPORT_DATA_CHANGED` (`CornerstoneViewportService.ts:492, 1229`).
- **Mid-drag frames without stats are ordinary** (`events/measurements.ts`): cornerstone recomputes
  `cachedStats` in the render pass, so the update path skips a measurement without stats silently.
- **Only the form knows which uid belongs to a row**: the viewer sends every update and the reducer
  ignores unknown uids (A-23).
- **OHIF types** (`ohif/surface.ts`): no OHIF package publishes declarations and the global `AppTypes` only
  resolves inside the OHIF monorepo, so the extension declares the members it calls.
- **Version overlay** (`ohif/surface.ts`): customizations merge in registration order after cornerstone, so
  `$push` appends to its list (`CustomizationService.ts:381-397`).
- **Throttle per key** (`ohif/throttle.ts`): one annotation's drag cannot swallow another's final value.

## OHIF facts behind specific lines (the code carries no comments, A-24)

`commands/handlers.ts`

- A released row returns to `WindowLevel`, OHIF's default primary-mouse tool (`modes/longitudinal … initToolGroups.ts:21-24`, A-23).
- `setToolActive`, not `setToolActiveToolbar`, which arms every tool group (`commandsModule.ts:1025-1068`); the tool group and `hasTool` are checked first because `setToolActive` fails silently without them.
- REMOVE for a uid the service no longer holds is answered at once (`MeasurementService.ts:675-680` returns silently; A-10); for a present uid the command is parked before `remove()` because the service broadcasts `MEASUREMENT_REMOVED` synchronously (`:674-689`), and cornerstone erases the drawing on that event (`initMeasurementService.ts:501-522`).
- FOCUS: an unknown uid is an ordinary race, not the error `jumpToMeasurement` would warn about (`MeasurementService.ts:741-745`); the measurement panel makes the same call (`commandsModule.ts:739-744`).

`extension.ts`

- `setToolActive` is a silent no-op until a viewport has a tool group (`commandsModule.ts:1050-1055`), so `VIEWER_READY` is announced on `toolGroupService` `VIEWPORT_ADDED` (A-9).
- OHIF's generated loader imports the default export of the package named in `pluginConfig.json` (`writePluginImportsFile.js:89-94`), so the configured extension is the default export.

`events/measurements.ts`

- `MEASUREMENT_ADDED` merges cornerstone's `ANNOTATION_ADDED` and `ANNOTATION_COMPLETED` into one event (`MeasurementService.ts:545-576`, P-4); `MEASUREMENT_REMOVED` carries only the uid (`:686-689`).
- `measurement.data` is `cachedStats` keyed per render target, normally `imageId:<referencedImageId>` (`measurementServiceMappings/EllipticalROI.ts:110`); the `RectangleROI` mapping has the same shape (`RectangleROI.ts:60-80`).
- No `'mm'` default as in OHIF's `Length.ts:118`: mm on an uncalibrated image would break Q-6.
- Geometry for restore comes from the measurement itself (`EllipticalROI.ts:61-81`, A-14); points are copied so the event does not carry cornerstone's live handle arrays.

`ohif/surface.ts`

- `window.config` reaches every extension through `preRegistration` (`ExtensionManager.ts:276-286`); the manager reads `id`, `preRegistration` and the module getters it finds (`:260-273`, `:297-341`), awaits the hook (`:277`), and `registerExtension` is public and re-entrant (`:251-286`), which is how the adapter registers its children.
- `getToolGroup()` without an id resolves the active viewport's group (`ToolGroupService.ts:73-104`).
- The version overlay uses `contentF`, not `label`, because the overlay renders one text node (`CustomizableViewportOverlay.tsx:380-397`); `$push` appends to cornerstone's list because customizations merge in registration order (`CustomizationService.ts:118-131, 381-397`).
- `process.env.VERSION_NUMBER` is replaced by OHIF's webpack at build time (`.webpack/webpack.base.js:32,46`); `process` never exists in the browser, so the expression is written exactly as DefinePlugin matches it.

`commands/restore.ts`

- `activeHandleIndex` must be `null`, not absent (`EllipticalROITool.js:445`); the group key for a string selector is `metadata.FrameOfReferenceUID` (`annotationState.js:59-68`, `addSRAnnotation.ts:142`); the study shown is the one the active display sets belong to (`DisplaySetService.ts:114`); a cornerstone viewport exists once `VIEWPORT_DATA_CHANGED` reported (`CornerstoneViewportService.ts:492, 509`).
- `invalidated: true` makes cornerstone recompute the stats and emit `ANNOTATION_MODIFIED`, which is how the restored value reaches the form through the update stream.

`packages/channel/src/peer.ts`, `channel.ts`

- The `version` is the channel's (A-25); a foreign version is logged once and dropped before the guard. The `readyOn` message flushes the queue before the application's handler runs (A-9); a post that finds no window keeps the remainder queued (Q-1). The armed row is cancelled by `useHostChannel` before it disposes the channel, only if the viewer was ready (Q-5, A-31).
