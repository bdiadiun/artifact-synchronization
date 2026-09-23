# Bridge internals

Implementation details of the bridge that are deliberate but not visible from the code alone.
Decisions live in [`docs/decisions/`](../decisions/); OHIF behaviour we rely on is in
[`ohif-api.md`](ohif-api.md). File names below refer to
`packages/scoring-viewer/src/` unless a path is given. The package is the OHIF-side application,
the form's peer, written as a React layer (A-32, A-34): `ScoringViewer.tsx` (`getContextModule`:
the provider OHIF mounts around the mode, which runs the hook and offers the channel through the
context), `session.ts` (the per-mount data: channel, armed row, pending restore, announced),
`hooks/useScoringViewer.ts` (`useChannel`, then two effects: `channel.on` → `handleCommand`,
`ohif.on` → `handleOhif`), `commands/handlers.ts` (`handleCommand`: one `switch` over the
commands), `commands/restore.ts`, `events/handlers.ts` (`handleOhif`: one `switch` over OHIF's
events), `ohif/facade.ts` (`createOhif`: OHIF's events in the contract's shape, throttled),
`ohif/metrics.ts` (the measurement object parsed), `ohif/surface.ts` (the OHIF types),
`ohif/throttle.ts` and `ohif/version.ts`. The channel is transport only (A-29, A-31).

## Lifecycle

- **Mounted and unmounted by OHIF** (`ScoringViewer.tsx`, A-32). `Mode.tsx` composes every
  extension's context-module provider around the mode (`createCombinedContextProvider`), so the
  application lives as long as the mode: a study change remounts it, which creates new per-mount
  data and announces `VIEWER_READY` again — the host then offers its rows back (A-29). The channel
  is the window's, not the mount's (A-34): `useChannel` names the peer on the first mount and
  leases the window `message` listener for each mount (attached with the first lease, released
  with the last), so a StrictMode double run or a Fast Refresh only re-leases the listener and
  never leaves a mounted application with a dead channel; the queue and `{ ready, queued }` live
  on. Leaving the mode tears the viewports and their tool group down, so no tool is left to
  restore.
- **A viewer opened outside the iframe has no peer** (`session.ts`): `window.parent` is passed to
  the channel only when it differs from `window`; otherwise `postTo` finds no window, logs once and
  queues, instead of posting to the viewer's own window with a target origin the browser refuses.
- **The announcement does not depend on effect order** (`ohif/facade.ts`, `events/handlers.ts`).
  A provider's effects run after its children's, so the first viewport can exist before the
  application subscribes: `ohif.on` delivers `VIEWER_READY` at once when a tool group already
  exists and on every `VIEWPORT_ADDED`; `handleOhif` sends it once per mount (`session.announced`),
  so a layout with several viewports announces once.
- **The OHIF services are required, not optional** (A-28, `ohif-service-availability.md`). The
  three core services exist before any extension runs; `toolGroupService` and
  `cornerstoneViewportService` are registered by `@ohif/extension-cornerstone`, which
  `pluginConfig.json` lists before our adapter. `getContextModule` checks the two cornerstone
  services once, at registration, and returns no provider without them; no other "service
  unavailable" branch exists.
- **OHIF's measurement object is parsed once** by the `OhifMeasurement` schema in `ohif/metrics.ts`
  when a measurement event arrives in `ohif/facade.ts`; `toMetrics` and `toGeometry` work on the
  parsed value, and what leaves the facade is already a contract event. An event whose payload is
  not a measurement (a bare uid string, no uid) is ignored with one warning.

## Measurements

- **Stats lookup** (`ohif/metrics.ts`). `measurement.data` is keyed by target; the entry
  `imageId:<referencedImageId>` is preferred, otherwise the first entry with a finite value.
- **No metrics on `MEASUREMENT_ADDED` means nothing is posted** (`ohif/facade.ts`). A half-formed event
  would move the row to `Готово` without a value; staying silent leaves it in `Малювання…` where
  the doctor can cancel or redraw.
- **`MEASUREMENT_UPDATED` goes out for every annotation** (`ohif/facade.ts`), throttled per uid;
  the form ignores a uid no row holds, so the extension keeps no `uid → rowId` map (A-23).
- **Silent mapping during drags** (`ohif/facade.ts`). On the update path a measurement without
  stats is skipped without a log: cornerstone fills `cachedStats` in its render pass, so
  intermediate drag frames without stats are normal.

## Commands

- **Every command goes through one `switch`** (`commands/handlers.ts`, registered with
  `channel.on`; exhaustiveness is the linter's): a command added to the contract without a
  case fails the type check, and an unknown type never reaches the switch because the contract
  guard rejects it on arrival.
- **A removal is fire-and-forget** (A-30): the handler calls `measurementService.remove` when the
  uid is present and sends nothing itself; OHIF's `MEASUREMENT_REMOVED` reaches the host through
  the subscription, for a row that is already gone.

## Host side

- **No separate `uid → rowId` map on the host** (`host-app/src/hooks/useScoringForm.ts`). A `done`
  row stores its own `measurementUid`, and `MEASUREMENT_ADDED` carries `rowId`, so the rows array
  is the map. The viewer keeps no map either: `session.armedRowId` (A-29) is set by
  `ACTIVATE_TOOL` and taken by the next `MEASUREMENT_ADDED`.

## Details moved out of the code (A-24)

- **Announce once** (`events/handlers.ts`): `ohif.on` delivers `VIEWER_READY` for every viewport
  and once at subscription when a tool group already exists; `handleOhif` sends the first per
  mount (`session.announced`); a mode remount mounts new per-mount data, which announces again.
- **Every measurement OHIF announces goes to the host** (`events/handlers.ts`); the one drawn
  while a row was armed carries that row's id and hands the viewer back to the default tool
  (A-8, A-23). Updates are throttled per measurement in the facade (`ohif/facade.ts`,
  `UPDATE_INTERVAL_MS`), so a dragged handle reaches the form live but not on every frame
  (S-5.1); a removal drops the update still pending for that uid, and the facade's unsubscribe
  clears every timer.
- **What OHIF's measurement object means for the host** (`ohif/metrics.ts`): the metrics the
  tool yields (`METRIC_KEYS_BY_TOOL`, A-40), each read from the `cachedStats` entry of the
  referenced image — the value under the metric's key, the unit under the field `UNIT_FIELD`
  names for it, spelled the way `UNITS` maps to the contract's vocabulary — and the geometry the
  form persists to rebuild the annotation later (A-14). `measure` is `null` when the event
  carries no measurement object, a tool the contract does not name, or stats with none of the
  tool's metrics (cornerstone fills `cachedStats` in its render pass, so the first event can be
  empty; the update stream delivers the value).
- **A restore waits for viewport data** (`commands/restore.ts`, `holdsViewportData`): annotations
  can only be added once the active viewport holds image data; a `RESTORE_MEASUREMENTS` that
  arrives earlier waits in `session.pendingRestore` for the next `VIEWPORT_DATA_CHANGED`.
- **The version overlay item** (`ohif/version.ts`) is S-5.5: the viewer version in the corner of
  every viewport, appended to OHIF's own overlay items.
- **The adapter is the one package the fork lists** (`packages/ohif-extension-loader/src/extension.ts`,
  A-20); its `preRegistration` registers the bridge extension itself.
- **Removal goes through OHIF** (`commands/handlers.ts`): `measurementService.remove` (the
  `removeMeasurement` command only wraps that call, `commandsModule.ts:746-751`) fires OHIF's
  `MEASUREMENT_REMOVED`, which `ohif.on` delivers and `handleOhif` forwards.
- **Focus** (`commands/handlers.ts`): cornerstone's `JUMP_TO_MEASUREMENT` handler selects the annotation and
  moves the camera (`commandsModule.ts:208-241`); an unknown uid is an ordinary race, not an error.
- **Restore is hand-built** (`commands/restore.ts`): `EllipticalROITool.hydrate` re-derives metadata from the
  live camera, needs an enabled element and drops the label; `activeHandleIndex` must be `null`,
  not absent, or the renderer indexes canvas coordinates with `undefined`
  (`EllipticalROITool.js:445`); the group key for `addAnnotation` comes from
  `metadata.FrameOfReferenceUID` for any string selector (`annotationState.js:59-68`); the viewport
  holds data only after `VIEWPORT_DATA_CHANGED` (`CornerstoneViewportService.ts:492, 1229`).
- **Mid-drag frames without stats are ordinary** (`ohif/facade.ts`): cornerstone recomputes
  `cachedStats` in the render pass, so the update path skips a measurement without stats silently.
- **Only the form knows which uid belongs to a row**: the viewer sends every update and the reducer
  ignores unknown uids (A-23).
- **OHIF types** (`ohif/surface.ts`): no OHIF package publishes declarations and the global `AppTypes` only
  resolves inside the OHIF monorepo, so the extension declares the members it calls.
- **Version overlay** (`ohif/version.ts`): customizations merge in registration order after cornerstone, so
  `$push` appends to its list (`CustomizationService.ts:381-397`).
- **Throttle per key** (`ohif/throttle.ts`): one annotation's drag cannot swallow another's final value.

## OHIF facts behind specific lines (the code carries no comments, A-24)

`commands/handlers.ts`

- A released row returns to `WindowLevel`, OHIF's default primary-mouse tool (`modes/longitudinal … initToolGroups.ts:21-24`, A-23).
- `setToolActive`, not `setToolActiveToolbar`, which arms every tool group (`commandsModule.ts:1025-1068`); the tool group and `hasTool` are checked first because `setToolActive` fails silently without them.
- REMOVE for a uid the service no longer holds is answered at once (`MeasurementService.ts:675-680` returns silently; A-10); for a present uid the command is parked before `remove()` because the service broadcasts `MEASUREMENT_REMOVED` synchronously (`:674-689`), and cornerstone erases the drawing on that event (`initMeasurementService.ts:501-522`).
- FOCUS: an unknown uid is an ordinary race, not the error `jumpToMeasurement` would warn about (`MeasurementService.ts:741-745`); the measurement panel makes the same call (`commandsModule.ts:739-744`).

`ScoringViewer.tsx`, `ohif/facade.ts`

- `setToolActive` is a silent no-op until a viewport has a tool group (`commandsModule.ts:1050-1055`), so `VIEWER_READY` is announced on `toolGroupService` `VIEWPORT_ADDED` (A-9).
- OHIF's generated loader imports the default export of the package named in `pluginConfig.json` (`writePluginImportsFile.js:89-94`), so the configured extension is the default export.
- `getContextModule` is called once at registration with `{ appConfig, servicesManager, commandsManager }` (`ExtensionManager.ts:463-469`); `getModulesByType('contextModule')` returns every registered extension's entries and `Mode.tsx:377-393` composes their `provider`s.

`ohif/facade.ts`, `ohif/metrics.ts`

- `MEASUREMENT_ADDED` merges cornerstone's `ANNOTATION_ADDED` and `ANNOTATION_COMPLETED` into one event (`MeasurementService.ts:545-576`, P-4); `MEASUREMENT_REMOVED` carries only the uid (`:686-689`).
- `measurement.data` is `cachedStats` keyed per render target, normally `imageId:<referencedImageId>` (`measurementServiceMappings/EllipticalROI.ts:110`); the `RectangleROI` mapping has the same shape (`RectangleROI.ts:60-80`).
- No `'mm'` default as in OHIF's `Length.ts:118`: mm on an uncalibrated image would break Q-6.
- Geometry for restore comes from the measurement itself (`EllipticalROI.ts:61-81`, A-14); points are copied so the event does not carry cornerstone's live handle arrays.

`ohif/surface.ts`

- `window.config` reaches every extension as `appConfig`, both in `preRegistration` (`ExtensionManager.ts:276-286`) and in every module getter (`:463-469`); the manager reads `id`, `preRegistration` and the module getters it finds (`:260-273`, `:297-341`), awaits the hook (`:277`), and `registerExtension` is public and re-entrant (`:251-286`), which is how the adapter registers its children.
- `getToolGroup()` without an id resolves the active viewport's group (`ToolGroupService.ts:73-104`).
- The version overlay uses `contentF`, not `label`, because the overlay renders one text node (`CustomizableViewportOverlay.tsx:380-397`); `$push` appends to cornerstone's list because customizations merge in registration order (`CustomizationService.ts:118-131, 381-397`).
- `process.env.VERSION_NUMBER` is replaced by OHIF's webpack at build time (`.webpack/webpack.base.js:32,46`); `process` never exists in the browser, so the expression is written exactly as DefinePlugin matches it.

`commands/restore.ts`

- `activeHandleIndex` must be `null`, not absent (`EllipticalROITool.js:445`); the group key for a string selector is `metadata.FrameOfReferenceUID` (`annotationState.js:59-68`, `addSRAnnotation.ts:142`); the study shown is the one the active display sets belong to (`DisplaySetService.ts:114`); a cornerstone viewport exists once `VIEWPORT_DATA_CHANGED` reported (`CornerstoneViewportService.ts:492, 509`).
- `invalidated: true` makes cornerstone recompute the stats and emit `ANNOTATION_MODIFIED`, which is how the restored value reaches the form through the update stream.

`packages/channel/src/peer.ts`, `channel.ts`

- One end of the channel per window, created when the module loads (A-34) — since A-39 the instance of `class ChannelEnd`, whose private fields are the state and whose arrow-function fields are the methods: `useChannel(options)` names the peer on the first mount and checks every later mount against it by value (`samePeer`; a mismatch is a `console.error`, the first peer stays), leases the window `message` listener per mount (`leases`: attached at one, removed at zero) and subscribes the calling component to `{ ready, queued }` with `useSyncExternalStore`. `on` is typed to take `(message: never) => void` and holds the package's one type assertion, so the instance is assignable to every `Channel<TIn>` without a cast on the way out; the listener only ever passes messages the `accept` guard admitted, which is what the assertion relies on.
- The `version` is the channel's (A-25); a foreign version is logged once and dropped before the guard. The `readyOn` message flushes the queue before the application's handler runs (A-9); a post that finds no window keeps the remainder queued (Q-1). Neither end cancels an armed row when it goes away: the host's channel lives as long as the page and the viewer dies with it; the extension's armed row lives in the bridge effect and dies with its mount (Q-5, A-31, A-32).
