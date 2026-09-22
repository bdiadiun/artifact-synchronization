# Defence notes

Where to point during the call. Host-app links are relative to this repository; extension links
read the viewer side in `packages/viewer-bridge/`, which is where it now lives
(`94108f3dfd`). If a line drifts after a later change, search for the quoted symbol.

## The protocol in one screen

| Concern                 | Host-app                                                                                                                                                    | Viewer extension                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Origin configured       | [`VIEWER_ORIGIN`](../host-app/src/config.ts#L4)                                                                                                             | [`HOST_ORIGIN`][fork-config]                                                                                                                           |
| Origin checked          | [`event.origin !== peer.origin`](../packages/channel/src/shared/peer.ts#L37)                                                                                | [the same check, the viewer end of the channel][fork-bridge-origin]                                                                                    |
| URL input validated     | [`study` parameter checked against a DICOM identifier, then `encodeURIComponent`](../host-app/src/config.ts)                                                | —                                                                                                                                                      |
| Payload validated       | [`isViewerEvent`](../packages/channel/src/host/hostChannel.ts#L149)                                                                                         | [`isHostCommand`][fork-commands-guard]                                                                                                                 |
| Handshake               | [READY flushes the outbox](../packages/channel/src/host/hostChannel.ts#L143)                                                                                | [VIEWPORT_ADDED subscription][fork-bridge-viewport] → [`announceReady`][fork-bridge-ready] → [`postMessage` with the host origin][fork-bridge-post]    |
| Early commands          | [`queued.push(command)`](../packages/channel/src/host/outbox.ts#L36), [`flush`](../packages/channel/src/host/outbox.ts#L41)                                 | —                                                                                                                                                      |
| Row id / measurement id | [`crypto.randomUUID()` in `addRow`](../host-app/src/form/rowActions.ts#L21)                                                                                 | [`getArmed()` on the channel][fork-bridge-map]                                                                                                         |
| Tool armed and restored | [`DEFAULT_TOOL`](../host-app/src/config.ts#L7)                                                                                                              | [fixed `DEFAULT_TOOL` after a measurement][fork-commands-snapshot], [`setToolActive`][fork-commands-active], [`disarm`][fork-commands-disarm]          |
| Measurement delivered   | [`rowId === null` ignored](../host-app/src/form/viewerEventHandlers.ts#L94)                                                                                 | [`MEASUREMENT_ADDED` subscription][fork-bridge-added], [posted][fork-bridge-added-post], [`toMetrics`][fork-metrics], [unit normalisation][fork-units] |
| Live update (S-5.1)     | reducer `MeasurementUpdated` in [`rows.ts`](../host-app/src/form/rows.ts#L19)                                                                               | [throttled emitter][fork-bridge-throttle], [`UPDATE_INTERVAL_MS`][fork-bridge-interval]                                                                |
| Deletion (S-5.2)        | [own echo consumed by the exchange](../host-app/src/form/rowActions.ts#L57)                                                                                 | [`pendingRemovals`][fork-removals-map], [`measurementService.remove`][fork-removals-remove], [`MEASUREMENT_REMOVED` subscription][fork-bridge-removed] |
| Second tool (S-5.4)     | [`LENGTH_TOOL`](../host-app/src/config.ts), row's own `toolName` in `ACTIVATE_TOOL`, separate totals per metric                                             | reuses `toMetrics` `Length` mapping                                                                                                                    |
| State restore (S-5.6)   | [`storage.ts`](../host-app/src/form/storage.ts), restore request in `viewerEventHandlers.ts`                                                                | `restore.ts` (readiness gate, re-add with the original uid), `geometry.ts`                                                                             |
| Focus (S-5.3)           | clickable Done row in `MeasurementRow.tsx`                                                                                                                  | [`jumpToMeasurement`][fork-focus]                                                                                                                      |
| Version overlay (S-5.5) | —                                                                                                                                                           | [`viewportOverlay.bottomRight`][fork-overlay]                                                                                                          |
| State and totals        | [`RowStatus`](../host-app/src/form/rows.ts#L8), [`FormActionType`](../host-app/src/form/rows.ts#L14), [`computeTotals`](../host-app/src/form/totals.ts#L24) | —                                                                                                                                                      |
| Diagnostics (P-9)       | [`BridgeStatus`](../host-app/src/components/BridgeStatus.tsx#L6)                                                                                            | log prefix `[scoring-bridge]` in the viewer console                                                                                                    |
| Entry point             | [`useHostChannel`](../host-app/src/channel/useHostChannel.ts)                                                                                               | [`preRegistration`][fork-index]                                                                                                                        |

[fork-config]: ../packages/viewer-bridge/src/extension.ts
[fork-index]: ../packages/viewer-bridge/src/extension.ts
[fork-bridge-origin]: ../packages/channel/src/shared/peer.ts#L37
[fork-bridge-post]: ../packages/channel/src/shared/peer.ts#L20
[fork-bridge-ready]: ../packages/channel/src/viewer/viewerChannel.ts#L144
[fork-bridge-viewport]: ../packages/viewer-bridge/src/extension.ts#L39
[fork-bridge-map]: ../packages/channel/src/viewer/viewerChannel.ts#L162
[fork-bridge-added]: ../packages/viewer-bridge/src/events/measurements.ts#L234
[fork-bridge-added-post]: ../packages/viewer-bridge/src/events/measurements.ts#L155
[fork-bridge-throttle]: ../packages/viewer-bridge/src/ohif/throttle.ts
[fork-bridge-interval]: ../packages/viewer-bridge/src/events/measurements.ts#L39
[fork-bridge-removed]: ../packages/viewer-bridge/src/events/measurements.ts#L236
[fork-commands-guard]: ../packages/channel/src/viewer/viewerChannel.ts#L170
[fork-commands-snapshot]: ../packages/viewer-bridge/src/commands/handlers.ts#L117
[fork-commands-active]: ../packages/viewer-bridge/src/commands/handlers.ts
[fork-commands-disarm]: ../packages/viewer-bridge/src/commands/handlers.ts
[fork-commands-idempotent]: ../packages/viewer-bridge/src/commands/handlers.ts
[fork-removals-map]: ../packages/viewer-bridge/src/commands/handlers.ts#L107
[fork-removals-cause]: ../packages/channel/src/viewer/viewerChannel.ts#L153
[fork-removals-remove]: ../packages/viewer-bridge/src/commands/handlers.ts#L74
[fork-focus]: ../packages/viewer-bridge/src/commands/handlers.ts#L131
[fork-metrics]: ../packages/viewer-bridge/src/events/measurements.ts
[fork-units]: ../packages/viewer-bridge/src/events/measurements.ts
[fork-overlay]: ../packages/viewer-bridge/src/ohif/surface.ts#L139

## Questions (canon P-1..P-6)

**P-1. The iframe loads slower than the user clicks.** "Активувати" calls `send`; while `ready` is
false the command goes to [`queued.push(command)`](../packages/channel/src/host/outbox.ts#L36) and
the status line shows `у черзі: N`. The viewer announces `VIEWER_READY` only after
[the first viewport joins a tool group][fork-bridge-viewport], because `setToolActive` is a silent
no-op before that. The host then [flushes the queue in order](../packages/channel/src/host/outbox.ts#L41).
Demo: stop the viewer, click "Активувати", start the viewer, watch the counter drain.

**P-2. Why `postMessage`.** The two apps have different origins, and `postMessage` is the only
browser channel between a window and a cross-origin iframe that carries a sender origin the
receiver can verify. On one origin we could call into `iframe.contentWindow` directly or use
`BroadcastChannel`; the origin checks would go, but the typed contract would stay, because it is
the seam between two separately deployed apps.

**P-3. Who issues which id.** The host issues `rowId`
([`crypto.randomUUID()`](../host-app/src/form/rowActions.ts#L21)) before anything is drawn, so an
empty `Очікує` row can exist. The viewer issues `measurementUid` (the cornerstone annotation UID)
and the viewer end of the channel [remembers the armed row][fork-bridge-map] until its measurement is sent; the rows array on the host is the only `uid → row` map. Flipping it breaks two things: the form could not show a
row before drawing, and OHIF's `_isValidMeasurement` rejects any foreign field, so a host id cannot
be stored on a measurement ([A-8](decisions/A-8-id-correlation.md)).

**P-4. Where we subscribe in OHIF.** [`measurementService.subscribe(MEASUREMENT_ADDED)`][fork-bridge-added]
inside `subscribeMeasurements`, called from [`preRegistration`][fork-index], where OHIF hands an extension its
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
[VIEWPORT_ADDED subscription][fork-bridge-viewport] → [`channel.announceReady`][fork-bridge-ready] → host
[READY branch](../packages/channel/src/host/hostChannel.ts#L143). If `ACTIVATE_TOOL` is disabled instead,
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
- [ ] P-9: comment out the `channel.announceReady` call in `extension.ts`, reload, diagnose aloud.

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
