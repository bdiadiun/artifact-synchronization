# Defence notes

Where to point during the call. Host-app links are relative to this repository; extension links
open the OHIF fork at the commit the `viewer` submodule is pinned to
(`68ffd3c643`). If a line drifts after a later change, search for the quoted symbol.

## The protocol in one screen

| Concern                 | Host-app                                                                                                                                                    | Viewer extension                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Origin configured       | [`VIEWER_ORIGIN`](../host-app/src/config.ts#L4)                                                                                                             | [`HOST_ORIGIN`][fork-config]                                                                                                                           |
| Origin checked          | [`event.origin !== viewerOrigin`](../host-app/src/bridge/createBridge.ts#L74)                                                                               | [`event.origin !== HOST_ORIGIN`][fork-bridge-origin]                                                                                                   |
| Payload validated       | [`isViewerEvent`](../host-app/src/bridge/createBridge.ts#L83)                                                                                               | [`isHostCommand`][fork-commands-guard]                                                                                                                 |
| Handshake               | [READY flushes the queue](../host-app/src/bridge/createBridge.ts#L97)                                                                                       | [VIEWPORT_ADDED subscription][fork-bridge-viewport] → [`postViewerReady`][fork-bridge-ready] → [`window.parent.postMessage`][fork-bridge-post]         |
| Early commands          | [`queue.push(command)`](../host-app/src/bridge/createBridge.ts#L113), [`flushQueue`](../host-app/src/bridge/createBridge.ts#L54)                            | —                                                                                                                                                      |
| Row id / measurement id | [`crypto.randomUUID()` in `addRow`](../host-app/src/form/useScoringForm.ts#L27)                                                                             | [`uidToRowId.set`][fork-bridge-map]                                                                                                                    |
| Tool armed and restored | [`DEFAULT_TOOL`](../host-app/src/config.ts#L7)                                                                                                              | [snapshot `getActivePrimaryMouseButtonTool`][fork-commands-snapshot], [`setToolActive`][fork-commands-active], [`disarm`][fork-commands-disarm]        |
| Measurement delivered   | [`rowId === null` ignored](../host-app/src/form/useScoringForm.ts#L134)                                                                                     | [`MEASUREMENT_ADDED` subscription][fork-bridge-added], [posted][fork-bridge-added-post], [`toMetrics`][fork-metrics], [unit normalisation][fork-units] |
| Live update (S-5.1)     | reducer `MeasurementUpdated` in [`rows.ts`](../host-app/src/form/rows.ts#L26)                                                                               | [throttled emitter][fork-bridge-throttle], [`UPDATE_INTERVAL_MS`][fork-bridge-interval]                                                                |
| Deletion (S-5.2)        | [own `causedBy` ignored](../host-app/src/form/useScoringForm.ts#L182)                                                                                       | [`pendingRemovals`][fork-removals-map], [`measurementService.remove`][fork-removals-remove], [`MEASUREMENT_REMOVED` subscription][fork-bridge-removed] |
| Focus (S-5.3)           | clickable Done row in `MeasurementRow.tsx`                                                                                                                  | [`jumpToMeasurement`][fork-focus]                                                                                                                      |
| Version overlay (S-5.5) | —                                                                                                                                                           | [`viewportOverlay.bottomRight`][fork-overlay]                                                                                                          |
| State and totals        | [`RowStatus`](../host-app/src/form/rows.ts#L6), [`FormActionType`](../host-app/src/form/rows.ts#L26), [`computeTotals`](../host-app/src/form/totals.ts#L24) | —                                                                                                                                                      |
| Diagnostics (P-9)       | [`BridgeStatus`](../host-app/src/components/BridgeStatus.tsx#L10)                                                                                           | log prefix `[scoring-bridge]` in the viewer console                                                                                                    |
| Entry point             | [`useBridge`](../host-app/src/bridge/useBridge.ts)                                                                                                          | [`preRegistration`][fork-index]                                                                                                                        |

[fork-config]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/config.ts#L2
[fork-index]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/index.tsx#L10
[fork-bridge-origin]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L84
[fork-bridge-post]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L75
[fork-bridge-ready]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L310
[fork-bridge-viewport]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L332
[fork-bridge-map]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L209
[fork-bridge-added]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L221
[fork-bridge-added-post]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L201
[fork-bridge-throttle]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L111
[fork-bridge-interval]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L31
[fork-bridge-removed]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/bridge.ts#L299
[fork-commands-guard]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/commands.ts#L162
[fork-commands-snapshot]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/commands.ts#L57
[fork-commands-active]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/commands.ts#L80
[fork-commands-disarm]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/commands.ts#L84
[fork-commands-idempotent]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/commands.ts#L99
[fork-removals-map]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/removals.ts#L24
[fork-removals-cause]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/removals.ts#L47
[fork-removals-remove]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/removals.ts#L52
[fork-focus]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/focus.ts#L39
[fork-metrics]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/measurements.ts#L150
[fork-units]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/measurements.ts#L50
[fork-overlay]: https://github.com/bdiadiun/Viewers/blob/68ffd3c64334962505cf08b24a7cad6769502b5d/extensions/scoring-bridge/src/getCustomizationModule.tsx#L5

## Questions (canon P-1..P-6)

**P-1. The iframe loads slower than the user clicks.** "Активувати" calls `send`; while `ready` is
false the command goes to [`queue.push(command)`](../host-app/src/bridge/createBridge.ts#L113) and
the status line shows `у черзі: N`. The viewer announces `VIEWER_READY` only after
[the first viewport joins a tool group][fork-bridge-viewport], because `setToolActive` is a silent
no-op before that. The host then [flushes the queue in order](../host-app/src/bridge/createBridge.ts#L97).
Demo: stop the viewer, click "Активувати", start the viewer, watch the counter drain.

**P-2. Why `postMessage`.** The two apps have different origins, and `postMessage` is the only
browser channel between a window and a cross-origin iframe that carries a sender origin the
receiver can verify. On one origin we could call into `iframe.contentWindow` directly or use
`BroadcastChannel`; the origin checks would go, but the typed contract would stay, because it is
the seam between two separately deployed apps.

**P-3. Who issues which id.** The host issues `rowId`
([`crypto.randomUUID()`](../host-app/src/form/useScoringForm.ts#L27)) before anything is drawn, so an
empty `Очікує` row can exist. The viewer issues `measurementUid` (the cornerstone annotation UID)
and keeps [`uidToRowId`][fork-bridge-map]. Flipping it breaks two things: the form could not show a
row before drawing, and OHIF's `_isValidMeasurement` rejects any foreign field, so a host id cannot
be stored on a measurement ([A-8](decisions/A-8-id-correlation.md)).

**P-4. Where we subscribe in OHIF.** [`measurementService.subscribe(MEASUREMENT_ADDED)`][fork-bridge-added]
inside `createBridge`, called from [`preRegistration`][fork-index], where OHIF hands an extension its
`servicesManager`. The service merges cornerstone's `ANNOTATION_ADDED` and `ANNOTATION_COMPLETED`
into one event on completion and returns an unsubscribe handle; raw cornerstone events would fire
on the first click.

**P-5. Two host-app tabs.** Each tab has its own iframe and its own `contentWindow`, and
`postMessage` is point to point, so tabs never see each other's messages or measurements.

**P-6. Where an infinite loop could arise.** OHIF re-broadcasts events when a measurement is
changed or removed through the service. The mandatory flow never sends a command in reaction to a
measurement event (a hook test asserts `send` is not called). The only mutating command is
deletion: the viewer [parks the request id][fork-removals-cause] and returns it as `causedBy`; the
host [ignores its own echo](../host-app/src/form/useScoringForm.ts#L182). Commands are also
idempotent ([same row already armed][fork-commands-idempotent]).

## Live changes (P-7..P-9)

**P-7. Ellipse → `RectangleROI`.** Change [`DEFAULT_TOOL`](../host-app/src/config.ts#L7). Nothing
else: the tool name travels in `ACTIVATE_TOOL`, the extension checks `toolGroup.hasTool`, and
[`toMetrics`][fork-metrics] already maps `RectangleROI`, which has the same stats shape.

**P-8. One more field through the whole chain (e.g. mean intensity).**

1. Extension: in [`toMetrics`][fork-metrics] add `mean: { value: stats.mean, unit: … }`; if a new
   unit is needed, extend `Unit` in [`packages/contract/src/messages.ts`](../packages/contract/src/messages.ts)
   and copy the file into the extension (`npm run check:contract` says when they differ).
2. Host: `MeasurementRow` already renders the first non-area metric; to show both, map over the
   metrics object.
3. Optional: `computeTotals(rows, 'mean')`.

**P-9. A protocol element is disabled (e.g. `VIEWER_READY`).** Symptoms: the
[status line](../host-app/src/components/BridgeStatus.tsx#L10) stays at `очікує VIEWER_READY`, the
queue count grows with each "Активувати", and the viewer console has no `VIEWER_READY sent`. Walk:
[`postViewerReady`][fork-bridge-ready] → [VIEWPORT_ADDED subscription][fork-bridge-viewport] → host
[READY branch](../host-app/src/bridge/createBridge.ts#L88). If `ACTIVATE_TOOL` is disabled instead,
the queue drains but the viewer logs no `armed row` and the tool stays WindowLevel.

## Rehearsal checklist

- [ ] Both apps start from a clean clone by README only.
- [ ] Three measurements in a row, total updates.
- [ ] Cancel: "Активувати", then "Скасувати" → row `Очікує`, tool back to WindowLevel.
- [ ] Drag an ellipse handle: the row value and total change while dragging.
- [ ] "Видалити" on a Done row removes the annotation; deleting it in OHIF returns the row to `Очікує`.
- [ ] Click a Done row: the viewer jumps to and selects the annotation.
- [ ] 2×2 layout: `OHIF 3.12.17` in every pane.
- [ ] P-7 swap to `RectangleROI` in under 2 minutes.
- [ ] P-9: comment out the `postToHost` call in `postViewerReady`, reload, diagnose aloud.

## Video script (D-8, 2–4 min)

| Time      | What to show                                                                                                                                        | What to say                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Terminal 1: `cd viewer && OHIF_OPEN=false yarn --cwd platform/app dev`. Terminal 2: `npm run dev --workspace host-app`. Open http://localhost:5173. | Two apps, two ports, one channel. The status line turns to `готовий` after `VIEWER_READY`.   |
| 0:25–1:15 | "Додати вимірювання" three times. For each row: "Активувати", draw an ellipse. Point at the value, the unit and "Разом".                            | Row ids come from the form, measurement ids from OHIF; the tool returns to the previous one. |
| 1:15–1:35 | Add a fourth row, "Активувати", then "Скасувати". Point at the OHIF toolbar.                                                                        | Cancel sends `DEACTIVATE_TOOL`; the row stays as `Очікує`.                                   |
| 1:35–2:00 | Drag a handle of one ellipse.                                                                                                                       | Live update, throttled to one message per 100 ms; the form never writes back, so no loop.    |
| 2:00–2:30 | "Видалити" on one row; then delete another annotation in OHIF's measurements panel.                                                                 | Deletion in both directions; the viewer tags our own echo with `causedBy`.                   |
| 2:30–2:50 | Click a Done row after scrolling the viewer away.                                                                                                   | Focus: OHIF jumps to the image and selects the annotation.                                   |
| 2:50–3:10 | Switch the layout to 2×2.                                                                                                                           | OHIF version from `version.txt`, injected at build time, in every viewport.                  |
