# Restoring an annotation after a page reload (S-5.6)

Read from the pinned fork (`viewer/`, OHIF v3.12.17) and its installed `@cornerstonejs/tools`
**4.15.29** / `@cornerstonejs/core` (both present under `viewer/node_modules/`). Paths are relative to
`viewer/`; `cst/` abbreviates `node_modules/@cornerstonejs/tools/dist/esm/`. Extends
[`ohif-bridge-api.md`](ohif-bridge-api.md) and [`bridge-internals.md`](bridge-internals.md).

## 1. Adding an annotation programmatically

`addAnnotation(annotation, annotationGroupSelector)` lives at
`cst/stateManagement/annotation/annotationState.js:54-69`: it fills a missing uid (`:55-57`), then
either resolves a group key from the selector and calls `triggerAnnotationAddedForElement` (`:59-63`)
or calls `manager.addAnnotation(annotation, undefined)` + `triggerAnnotationAddedForFOR` (`:66-67`),
returning the uid. The second argument is `AnnotationGroupSelector = HTMLDivElement | string`
(`cst/types/AnnotationGroupSelector.d.ts:1`) — a string is the group key verbatim, a div resolves to
its viewport's `FrameOfReferenceUID` (`cst/…/FrameOfReferenceSpecificAnnotationManager.js:4-14`).
**Omitting it is legal**: the manager falls back to `annotation.metadata.FrameOfReferenceUID`
(`ibid.:76-79`), so no viewport is needed.

OHIF's call sites: `extensions/cornerstone-dicom-sr/src/utils/addSRAnnotation.ts:142` —
`annotation.state.addAnnotation(SRAnnotation);` with **no selector**, the comment at `:137-138` noting
that `annotationManager.addAnnotation()` "was not triggering annotation_added events properly";
`extensions/cornerstone/src/initMeasurementService.ts:492` — `annotationManager.addAnnotation(newAnnotation)`
on `RAW_MEASUREMENT_ADDED` (deliberately event-less, the measurement already exists);
`extensions/cornerstone/src/commandsModule.ts:414` — `cornerstoneTools.SegmentBidirectionalTool.hydrate(...)`.

Per-tool helper `EllipticalROITool.hydrate(viewportId, points, options)`
(`cst/tools/annotation/EllipticalROITool.js:625-656`; `LengthTool.js:331`) builds the object and calls
`addAnnotation` + `triggerAnnotationRenderForViewportIds`, deriving metadata from the live camera
(`cst/tools/base/AnnotationTool.js:238-277`). It needs an enabled element, drops the label (`:639`) and
**returns nothing** for the ellipse — the uid goes in via `options.annotationUID` (`:638`).

## 2. Required annotation shape

Templates: `addSRAnnotation.ts:105-133`, `EllipticalROITool.js:637-655`.

| field                                 | needed?                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `annotationUID`                       | optional; generated if falsy (`annotationState.js:55-57`) — we supply it                                                                                                                                                                                                                                   |
| `metadata.toolName`                   | **mandatory** — the manager buckets by it (`FrameOfReference…:78,86-89`), the mapper reads it (`EllipticalROI.ts:29-34`)                                                                                                                                                                                   |
| `metadata.FrameOfReferenceUID`        | **mandatory** with no selector — it _is_ the group key (`ibid.:79`)                                                                                                                                                                                                                                        |
| `metadata.referencedImageId`          | **mandatory in practice** — stack display filtering (`cst/utilities/planar/filterAnnotationsForDisplay.js:9-24`) and `getSOPInstanceAttributes` key off it                                                                                                                                                 |
| `data.handles.points`                 | **mandatory** — world `Point3[]`, mapped to canvas at `EllipticalROITool.js:400`                                                                                                                                                                                                                           |
| `data.cachedStats`                    | omit / `{}` — recomputed on render (§4)                                                                                                                                                                                                                                                                    |
| `data.label`                          | optional; persist if the host displays it                                                                                                                                                                                                                                                                  |
| `isLocked` / `isVisible` / `textBox`  | leave out — the manager's `preprocessingFn` defines them on insert (`cst/stateManagement/annotation/resetAnnotationManager.js:7-17`); `highlighted` is cosmetic                                                                                                                                            |
| `invalidated`                         | set **`true`** on purpose (§4)                                                                                                                                                                                                                                                                             |
| `metadata.viewPlaneNormal` / `viewUp` | **not needed for a stack viewport**; only volume viewports filter by normal and back-fill it from image orientation when absent (`cst/utilities/planar/filterAnnotationsWithinSlice.js:37-44`). `hydrateBase` itself sets both `undefined` when `referencedImageId` is given (`AnnotationTool.js:251-255`) |

`Length` needs the same set; only the stats key differs (`length` + `unit`, `Length.ts:118`).

## 3. Can we choose the `annotationUID`?

Yes — it is overwritten **only** when falsy (`annotationState.js:55-57`), then the manager pushes the
object as-is (`FrameOfReferenceSpecificAnnotationManager.js:91-94`). OHIF depends on this:
`annotationUID: TrackingUniqueIdentifier` (`addSRAnnotation.ts:106`), `annotationUID: measurement.uid`
(`initMeasurementService.ts:463`). Since OHIF forces `measurement.uid = annotationUID`
(`initMeasurementService.ts:253`, `EllipticalROI.ts:62`), a restored annotation keeps the uid the host
stored and the bridge's `uid → rowId` map survives the reload.

## 4. What the measurement service does on restore

`addAnnotation` fires `ANNOTATION_ADDED` (`cst/stateManagement/annotation/helpers/state.js:4-13`
element form; `:15-41` FOR form, emitting once per matching viewport or once without a `viewportId` if
none match). OHIF listens at `initMeasurementService.ts:338` → `addMeasurement` → `annotationToMeasurement`.
But **`MEASUREMENT_ADDED` is not broadcast**: with no `oldMeasurement` the service only stores it
(`platform/core/src/services/MeasurementService/MeasurementService.ts:572-575`, "Measurement started."),
so our `MEASUREMENT_ADDED` subscriber will not see a restored annotation.

`cachedStats` are recomputed **in the render pass**: an empty `cachedStats[targetId]` (or null
`areaUnit`) triggers a synchronous `_calculateCachedStats` (`EllipticalROITool.js:403-414`); existing
stats plus `invalidated` use the 100 ms throttled variant (`:415-416`, `:623`). At the end it clears
`invalidated` and fires `ANNOTATION_MODIFIED` **only if it was true** (`:612-615`). That reaches
`updateMeasurement` (`initMeasurementService.ts:340`), the measurement is present by then, and
`MEASUREMENT_UPDATED` is broadcast with the real area.

## 5. What we already receive vs. what must be persisted

`measurementService` gives us (`EllipticalROI.ts:61-81`) `uid`, `points`, `metadata` (the cornerstone
object by reference: `toolName`, `FrameOfReferenceUID`, `referencedImageId`), `referencedImageId`,
`toolName`, `label`, `displaySetInstanceUID`, `data` (= `cachedStats`) — a superset of §2. Nothing is
missing: `{ uid, toolName, FrameOfReferenceUID, referencedImageId, points, label }` rebuilds the
annotation and is already in the `MEASUREMENT_ADDED` payload the bridge posts. Also persist the
**`StudyInstanceUIDs`** — a restored annotation is meaningless against another study.

## 6. Timing

The hard constraint is metadata, not rendering: the mapper calls
`cornerstone.metaData.get('instance', imageId)` and dereferences it unguarded
(`extensions/cornerstone/src/utils/measurementServiceMappings/utils/getSOPInstanceAttributes.js:57-65`).
Too early → throws, `addMeasurement` swallows it (`initMeasurementService.ts:257-259`), and the
annotation exists in cornerstone but never becomes a measurement.

Signals, earliest to safest: `toolGroupService.EVENTS.VIEWPORT_ADDED`, already used by the handshake
(`packages/viewer-bridge/src/extension.ts`, the `VIEWPORT_ADDED` subscription) — means "a tool group exists", enough for
`setToolActive` but **not** for restore; `cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED`
(`extensions/cornerstone/src/services/ViewportService/CornerstoneViewportService.ts:44`, broadcast
`:492`, `:1229`) — the viewport now has its display set data, the right hook; `VIEWPORT_NEW_IMAGE_SET`
on the element (`CornerstoneViewportService.ts:834`) or `IMAGE_RENDERED`
(`extensions/cornerstone/src/utils/initViewTiming.ts:36`) — latest and safest.

## 7. Rendering

`addAnnotation` does not render. Call `triggerAnnotationRenderForViewportIds([viewportId])` — what
cornerstone's `hydrate` does (`EllipticalROITool.js:656`) and what OHIF does after label/visibility
edits (`initMeasurementService.ts:423-428`). It also drives the `cachedStats` recompute of §4. No
`renderingEngine.render()` needed.

## 8. Risks

- **Wrong slice / wrong display set** — silently filtered out of rendering:
  `filterAnnotationsForDisplay` defers to `viewport.isReferenceViewable(metadata, { imageURI })`
  (`cst/utilities/planar/filterAnnotationsForDisplay.js:9-24`), `false` unless `referencedImageId` is
  the current image or `withNavigation` is set
  (`node_modules/@cornerstonejs/core/dist/esm/RenderingEngine/StackViewport.js:1816-1845`). The
  annotation stays in state, invisible, until the user scrolls to that slice.
- **Unknown `referencedImageId`** — `metaData.get('instance', …)` returns `undefined` and
  `getSOPInstanceAttributes.js:58-63` throws; annotation added, no measurement, no area ever posted.
- **Unknown `FrameOfReferenceUID`** — nothing throws: an orphan group is created
  (`FrameOfReferenceSpecificAnnotationManager.js:79-85`) that no viewport queries, and
  `triggerAnnotationAddedForFOR` emits with no `viewportId` (`helpers/state.js:33-36`). Silent no-op.
- **Double restore** — no de-duplication by uid: `addAnnotation` pushes unconditionally, `getAnnotation`
  returns the first match (manager `:48-61`), `removeAnnotation` deletes one per call.
- **Not verified at runtime** — all of the above is read from source. Two claims deserve one console
  session before the slice closes: that restore yields **no** `MEASUREMENT_ADDED` but does yield
  `MEASUREMENT_UPDATED` after render (§4), and the `VIEWPORT_DATA_CHANGED` → metadata-ready ordering (§6).

## Design implications

- **Full annotation restore is feasible in this version, with caveats.** The API is public, and OHIF
  itself uses it for DICOM SR — no private back door.
- **The uid is ours to keep.** A supplied `annotationUID` is preserved, so the host's stored
  `measurementUid` stays valid and the `uid → rowId` map can be rebuilt from the persisted rows.
- **Simplest reliable approach: persist six fields and re-add the raw object.** Store
  `{ uid, toolName, FrameOfReferenceUID, referencedImageId, points, label }` per row plus the study
  UID, then `annotation.state.addAnnotation(obj)` **without a selector** — metadata carries the group
  key, so no viewport lookup is needed and the code matches `addSRAnnotation.ts:142`.
- **Prefer the hand-built object over `EllipticalROITool.hydrate`** — it re-derives metadata from the
  live camera, needs an enabled element, drops the label and returns nothing.
- **Set `invalidated: true`, leave `cachedStats` empty.** Stats are recomputed on render, and
  `invalidated` is what makes cornerstone emit `ANNOTATION_MODIFIED` afterwards; a persisted area could
  also be stale against different calibration.
- **Observe restore through `MEASUREMENT_UPDATED`, not `MEASUREMENT_ADDED`.** The bridge's rule
  "stream updates only for measurements bound to a row" means the uid → row map must be seeded
  _before_ the annotations are added.
- **Gate restore on `VIEWPORT_DATA_CHANGED`, not on the existing `VIEWPORT_ADDED` handshake** — adding
  too early fails inside a `try/catch` and leaves an annotation with no measurement.
- **Refuse restore when the study does not match.** Mismatched `referencedImageId` /
  `FrameOfReferenceUID` fail silently, so persist the study UID with the rows and drop saved state on
  a different study.
