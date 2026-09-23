# Defence notes

Where to point during the call. Host-app links are relative to this repository; extension links
read the viewer side in `packages/viewer-bridge/`, which is where it now lives
(`94108f3dfd`). If a line drifts after a later change, search for the quoted symbol.

## The protocol in one screen

| Concern                 | Host-app                                                                                                                                                                                          | Viewer extension                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Origin configured       | [`VIEWER_ORIGIN`](../host-app/src/config.ts#L5)                                                                                                                                                   | [`HOST_ORIGIN`][fork-config]                                                                                                                                 |
| Origin checked          | [`event.origin !== peerOrigin`](../packages/channel/src/peer.ts#L37)                                                                                                                              | [the same check, the viewer end of the channel][fork-bridge-origin]                                                                                          |
| URL input validated     | [`study` parameter checked against a DICOM identifier, then `encodeURIComponent`](../host-app/src/config.ts)                                                                                      | —                                                                                                                                                            |
| Payload validated       | [`accept: isViewerEvent`](../host-app/src/config.ts#L9)                                                                                                                                           | [`isHostCommand`][fork-commands-guard]                                                                                                                       |
| Handshake               | [`readyOn` flushes the queue](../packages/channel/src/channel.ts#L50)                                                                                                                             | [VIEWPORT_ADDED subscription][fork-bridge-viewport] → [`VIEWER_READY` sent once][fork-bridge-ready] → [`postMessage` with the host origin][fork-bridge-post] |
| Early commands          | [`queued.push(message)`](../packages/channel/src/channel.ts#L45), [`open`](../packages/channel/src/channel.ts#L50)                                                                                | —                                                                                                                                                            |
| Row id / measurement id | [`crypto.randomUUID()` in `addRow`](../host-app/src/state/actions.ts#L10)                                                                                                                         | [`bridge.armedRowId = rowId`][fork-bridge-map], [taken by the next measurement][fork-bridge-take]                                                            |
| Tool armed and restored | [`DEFAULT_TOOL`](../host-app/src/config.ts#L18)                                                                                                                                                   | [fixed `DEFAULT_TOOL` after a measurement][fork-commands-snapshot], [`setToolActive`][fork-commands-active], [`disarm`][fork-commands-disarm]                |
| Measurement delivered   | [`rowId === null` changes nothing](../host-app/src/state/reducer.ts#L91)                                                                                                                          | [`MEASUREMENT_ADDED` subscription][fork-bridge-added], [posted][fork-bridge-added-post], [`toMetrics`][fork-metrics], [unit normalisation][fork-units]       |
| Live update (S-5.1)     | reducer `MEASUREMENT_UPDATED` in [`reducer.ts`](../host-app/src/state/reducer.ts#L105)                                                                                                            | [throttled emitter][fork-bridge-throttle], [`UPDATE_INTERVAL_MS`][fork-bridge-interval]                                                                      |
| Deletion (S-5.2)        | [fire-and-forget `REMOVE_MEASUREMENT`](../host-app/src/state/actions.ts#L31), reducer ignores an unknown uid ([`clearMeasurement`](../host-app/src/state/reducer.ts#L118))                        | [`measurementService.remove`][fork-removals-remove], [`MEASUREMENT_REMOVED` subscription][fork-bridge-removed]                                               |
| Second tool (S-5.4)     | [`LENGTH_TOOL`](../host-app/src/config.ts), row's own `toolName` in `ACTIVATE_TOOL`, separate totals per metric                                                                                   | reuses `toMetrics` `Length` mapping                                                                                                                          |
| State restore (S-5.6)   | [`storedRows.ts`](../host-app/src/services/storedRows.ts) over [`storage.ts`](../host-app/src/services/storage.ts), [`restoreViewer`](../host-app/src/state/actions.ts#L64) on every announcement | `restore.ts` (readiness gate, re-add with the original uid), `ohif/metrics.ts` (`toGeometry`)                                                                |
| Focus (S-5.3)           | clickable Done row in `MeasurementRow.tsx`                                                                                                                                                        | [`jumpToMeasurement`][fork-focus]                                                                                                                            |
| Version overlay (S-5.5) | —                                                                                                                                                                                                 | [`viewportOverlay.bottomRight`][fork-overlay]                                                                                                                |
| State and totals        | [`RowStatus`](../host-app/src/state/reducer.ts#L18), [`FormAction`](../host-app/src/state/reducer.ts#L41), [`computeTotals`](../host-app/src/utils/totals.ts#L17)                                 | —                                                                                                                                                            |
| Diagnostics (P-9)       | [`BridgeStatus`](../host-app/src/components/BridgeStatus.tsx#L6)                                                                                                                                  | log prefix `[scoring-bridge]` in the viewer console                                                                                                          |
| Entry point             | [`useScoringForm.ts`](../host-app/src/hooks/useScoringForm.ts) (`useChannel`, `channel.on` in an effect whose cleanup detaches it, Q-5)                                                           | [`getContextModule` → provider → `useScoringBridge`][fork-index]                                                                                             |

[fork-config]: ../packages/viewer-bridge/src/ScoringBridge.tsx#L22
[fork-index]: ../packages/viewer-bridge/src/hooks/useScoringBridge.ts
[fork-bridge-origin]: ../packages/channel/src/peer.ts#L37
[fork-bridge-post]: ../packages/channel/src/peer.ts#L17
[fork-bridge-ready]: ../packages/viewer-bridge/src/events/handlers.ts#L22
[fork-bridge-viewport]: ../packages/viewer-bridge/src/ohif/facade.ts#L84
[fork-bridge-map]: ../packages/viewer-bridge/src/commands/handlers.ts#L41
[fork-bridge-take]: ../packages/viewer-bridge/src/events/handlers.ts#L9
[fork-bridge-added]: ../packages/viewer-bridge/src/ohif/facade.ts#L81
[fork-bridge-added-post]: ../packages/viewer-bridge/src/events/handlers.ts#L11
[fork-bridge-throttle]: ../packages/viewer-bridge/src/ohif/throttle.ts
[fork-bridge-interval]: ../packages/viewer-bridge/src/ohif/facade.ts#L17
[fork-bridge-removed]: ../packages/viewer-bridge/src/ohif/facade.ts#L83
[fork-commands-guard]: ../packages/viewer-bridge/src/hooks/useScoringBridge.ts#L13
[fork-commands-snapshot]: ../packages/viewer-bridge/src/commands/handlers.ts#L7
[fork-commands-active]: ../packages/viewer-bridge/src/commands/handlers.ts
[fork-commands-disarm]: ../packages/viewer-bridge/src/commands/handlers.ts#L44
[fork-removals-remove]: ../packages/viewer-bridge/src/commands/handlers.ts#L52
[fork-focus]: ../packages/viewer-bridge/src/commands/handlers.ts#L35
[fork-metrics]: ../packages/viewer-bridge/src/ohif/metrics.ts
[fork-units]: ../packages/viewer-bridge/src/ohif/metrics.ts#L25
[fork-overlay]: ../packages/viewer-bridge/src/ohif/version.ts#L18

## Questions (canon P-1..P-6)

**P-1. The iframe loads slower than the user clicks.** "Активувати" calls `send`; while `ready` is
false the command goes to [`queued.push(message)`](../packages/channel/src/channel.ts#L45) and
the status line shows `у черзі: N`. The viewer announces `VIEWER_READY` only after
[the first viewport joins a tool group][fork-bridge-viewport], because `setToolActive` is a silent
no-op before that. The host then [flushes the queue in order](../packages/channel/src/channel.ts#L50).
Demo: stop the viewer, click "Активувати", start the viewer, watch the counter drain.

**P-2. Why `postMessage`.** The two apps have different origins, and `postMessage` is the only
browser channel between a window and a cross-origin iframe that carries a sender origin the
receiver can verify. On one origin we could call into `iframe.contentWindow` directly or use
`BroadcastChannel`; the origin checks would go, but the typed contract would stay, because it is
the seam between two separately deployed apps.

**P-3. Who issues which id.** The host issues `rowId`
([`crypto.randomUUID()`](../host-app/src/state/actions.ts#L12)) before anything is drawn, so an
empty `Очікує` row can exist. The viewer issues `measurementUid` (the cornerstone annotation UID)
and the extension [remembers the armed row][fork-bridge-map] until the next measurement [takes it][fork-bridge-take]; the rows array on the host is the only `uid → row` map. Flipping it breaks two things: the form could not show a
row before drawing, and OHIF's `_isValidMeasurement` rejects any foreign field, so a host id cannot
be stored on a measurement ([A-8](decisions/A-8-id-correlation.md)).

**P-4. Where we subscribe in OHIF.** [`measurementService.subscribe(MEASUREMENT_ADDED)`][fork-bridge-added]
inside `ohif.on`, run by an effect of [`useScoringBridge`][fork-index] with the
`servicesManager` OHIF hands the extension at registration. The service merges cornerstone's `ANNOTATION_ADDED` and `ANNOTATION_COMPLETED`
into one event on completion and returns an unsubscribe handle; raw cornerstone events would fire
on the first click.

**P-5. Two host-app tabs.** Each tab has its own iframe and its own `contentWindow`, and
`postMessage` is point to point, so tabs never see each other's messages or measurements.

**P-6. Where an infinite loop could arise.** OHIF re-broadcasts events when a measurement is
changed or removed through the service. The mandatory flow never sends a command in reaction to a
measurement event: every viewer event is [dispatched to the reducer as it is](../host-app/src/hooks/useScoringForm.ts#L19),
and a reducer cannot send (A-30); the one command sent in reaction to an event is the restore on
`VIEWER_READY`, which is a handshake, not a measurement. The only mutating command is deletion: the
form drops the row and sends `REMOVE_MEASUREMENT`; OHIF's own `MEASUREMENT_REMOVED` comes back for
a uid no row holds and the reducer [returns the same state](../host-app/src/state/reducer.ts#L114).
Nothing is sent, so nothing can bounce.

## Live changes (P-7..P-9)

**P-7. Ellipse → `RectangleROI`.** Change [`DEFAULT_TOOL`](../host-app/src/config.ts#L18). Nothing
else: the tool name travels in `ACTIVATE_TOOL`, the extension checks `toolGroup.hasTool`, and
[`toMetrics`][fork-metrics] already maps `RectangleROI`, which has the same stats shape.

**P-8. One more field through the whole chain (e.g. mean intensity).**

1. Contract: add `'mean'` to the `MetricKey` enum in
   [`packages/contract/src/vocabulary.ts`](../packages/contract/src/vocabulary.ts) (and a unit to
   `Unit` if a new one is needed) — one line each, since A-28 the vocabulary is the only place a
   metric is named; then publish the package and raise its pinned version in the extension.
2. Extension: in [`toMetrics`][fork-metrics] read `stats.mean` the way `area` is read.
3. Host: `MeasurementRow` already renders the first non-area metric; to show both, map over the
   metrics object; `computeTotals(rows, 'mean')` gives the total.

**P-9. A protocol element is disabled (e.g. `VIEWER_READY`).** Symptoms: the
[status line](../host-app/src/components/BridgeStatus.tsx#L6) stays at `очікує VIEWER_READY`, the
queue count grows with each "Активувати", and the viewer console has no `[channel] sent VIEWER_READY`. Walk:
[VIEWPORT_ADDED subscription][fork-bridge-viewport] → [`VIEWER_READY` sent once][fork-bridge-ready] → host
[`readyOn` branch](../packages/channel/src/channel.ts#L88). If `ACTIVATE_TOOL` is disabled instead,
the queue drains but the viewer console has no `[channel] received ACTIVATE_TOOL` and the tool stays WindowLevel.

## Rehearsal checklist

- [ ] Both apps start from a clean clone by README only.
- [ ] Three measurements in a row, total updates.
- [ ] Cancel: "Активувати", then "Скасувати" → row `Очікує`, tool back to WindowLevel.
- [ ] Drag an ellipse handle: the row value and total change while dragging.
- [ ] Add a length row, draw a line: it lands in that row in mm and the length total is separate.
- [ ] "Видалити" on a Done row removes the annotation; deleting it in OHIF returns the row to `Очікує`.
- [ ] Click a Done row: the viewer jumps to and selects the annotation.
- [ ] Reload the page with two measurements: rows, values, totals and both annotations come back.
- [ ] 2×2 layout: `OHIF 3.12.17` in every pane.
- [ ] P-7 swap to `RectangleROI` in under 2 minutes.
- [ ] P-9: comment out the `bridge.channel.send(event)` of the `VIEWER_READY` case in `events/handlers.ts`, reload, diagnose aloud.

## Video script (D-8, 2–4 min)

| Time      | What to show                                                                                                                                        | What to say                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Terminal 1: `cd viewer && OHIF_OPEN=false yarn --cwd platform/app dev`. Terminal 2: `npm run dev --workspace host-app`. Open http://localhost:5173. | Two apps, two ports, one channel. The status line turns to `готовий` after `VIEWER_READY`.                                                                                   |
| 0:25–1:15 | "Додати вимірювання" three times. For each row: "Активувати", draw an ellipse. Point at the value, the unit and "Разом".                            | Row ids come from the form, measurement ids from OHIF; the tool returns to the previous one.                                                                                 |
| 1:15–1:35 | Add a fourth row, "Активувати", then "Скасувати". Point at the OHIF toolbar.                                                                        | Cancel sends `DEACTIVATE_TOOL`; the row stays as `Очікує`.                                                                                                                   |
| 1:50–2:10 | Drag a handle of one ellipse.                                                                                                                       | Live update, throttled to one message per 100 ms; the form never writes back, so no loop.                                                                                    |
| 1:35–1:50 | Click "Додати довжину", activate it, draw a line across the image. Point at the two totals.                                                         | The row carries its own tool, so the same command activates the ruler; areas and lengths are summed separately and units are never mixed.                                    |
| 2:10–2:35 | "Видалити" on one row; then delete another annotation in OHIF's measurements panel.                                                                 | Deletion in both directions; the viewer tags our own echo with `causedBy`.                                                                                                   |
| 2:35–2:55 | Click a Done row after scrolling the viewer away.                                                                                                   | Focus: OHIF jumps to the image and selects the annotation.                                                                                                                   |
| 2:55–3:10 | Reload the page (F5) and wait a moment.                                                                                                             | The form persists rows and the annotation geometry per tab and per study; the viewer rebuilds the annotations with their original ids, so the correlation survives a reload. |
| 3:10–3:25 | Switch the layout to 2×2.                                                                                                                           | OHIF version from `version.txt`, injected at build time, in every viewport.                                                                                                  |
