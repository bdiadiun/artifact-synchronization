# Defence notes

Where to point during the call. Host-app links are relative to this repository; extension links
read the viewer side in `packages/scoring-viewer/`, which is where it now lives
(`94108f3dfd`). If a line drifts after a later change, search for the quoted symbol.

## The protocol in one screen

| Concern                 | Host-app                                                                                                                                                                                             | Viewer extension                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Origin configured       | [`VIEWER_ORIGIN`](../host-app/src/config.ts#L5)                                                                                                                                                      | [`HOST_ORIGIN`][fork-config]                                                                                                                                 |
| Origin checked          | [`event.origin !== peerOrigin`](../packages/channel/src/peer.ts#L37)                                                                                                                                 | [the same check, the viewer end of the channel][fork-bridge-origin]                                                                                          |
| URL input validated     | [`study` parameter checked against a DICOM identifier, then `encodeURIComponent`](../host-app/src/config.ts)                                                                                         | —                                                                                                                                                            |
| Payload validated       | [`accept: isViewerEvent`](../host-app/src/config.ts#L9)                                                                                                                                              | [`isHostCommand`][fork-commands-guard]                                                                                                                       |
| Handshake               | [`readyOn` flushes the queue](../packages/channel/src/channel.ts#L50)                                                                                                                                | [VIEWPORT_ADDED subscription][fork-bridge-viewport] → [`VIEWER_READY` sent once][fork-bridge-ready] → [`postMessage` with the host origin][fork-bridge-post] |
| Early commands          | [`queued.push(message)`](../packages/channel/src/channel.ts#L45), [`open`](../packages/channel/src/channel.ts#L50)                                                                                   | —                                                                                                                                                            |
| Row id / measurement id | [`crypto.randomUUID()` in `RowModel.create`](../host-app/src/models/row.ts#L35)                                                                                                                      | [`session.armedRowId = rowId`][fork-bridge-map], [taken by the next measurement][fork-bridge-take]                                                           |
| Tool armed and restored | [`DEFAULT_TOOL`](../host-app/src/config.ts#L18)                                                                                                                                                      | [fixed `DEFAULT_TOOL` after a measurement][fork-commands-snapshot], [`setToolActive`][fork-commands-active], [`disarm`][fork-commands-disarm]                |
| Measurement delivered   | [`rowId === null` changes nothing](../host-app/src/state/reducer.ts#L91)                                                                                                                             | [`MEASUREMENT_ADDED` subscription][fork-bridge-added], [posted][fork-bridge-added-post], [`toMetrics`][fork-metrics], [unit normalisation][fork-units]       |
| Live update (S-5.1)     | reducer `MEASUREMENT_UPDATED` in [`reducer.ts`](../host-app/src/state/reducer.ts#L105)                                                                                                               | [throttled emitter][fork-bridge-throttle], [`UPDATE_INTERVAL_MS`][fork-bridge-interval]                                                                      |
| Deletion (S-5.2)        | [fire-and-forget `REMOVE_MEASUREMENT`](../host-app/src/state/actions.ts#L31), reducer ignores an unknown uid ([`clearMeasurement`](../host-app/src/state/reducer.ts#L118))                           | [`measurementService.remove`][fork-removals-remove], [`MEASUREMENT_REMOVED` subscription][fork-bridge-removed]                                               |
| Second tool (S-5.4)     | [`LENGTH_TOOL`](../host-app/src/config.ts), row's own `toolName` in `ACTIVATE_TOOL`, separate totals per metric                                                                                      | reuses `toMetrics` `Length` mapping                                                                                                                          |
| State restore (S-5.6)   | [`useStoredRows.ts`](../host-app/src/hooks/useStoredRows.ts) over [`storage.ts`](../host-app/src/services/storage.ts), [`restoreViewer`](../host-app/src/state/actions.ts#L64) on every announcement | `restore.ts` (readiness gate, re-add with the original uid), `ohif/metrics.ts` (`toGeometry`)                                                                |
| Focus (S-5.3)           | clickable Done row in `MeasurementRow.tsx`                                                                                                                                                           | [`jumpToMeasurement`][fork-focus]                                                                                                                            |
| Version overlay (S-5.5) | —                                                                                                                                                                                                    | [`viewportOverlay.bottomRight`][fork-overlay]                                                                                                                |
| State and totals        | [`RowStatus`](../host-app/src/state/reducer.ts#L18), [`FormAction`](../host-app/src/state/reducer.ts#L41), [`computeTotals`](../host-app/src/utils/totals.ts#L17)                                    | —                                                                                                                                                            |
| Diagnostics (P-9)       | [`BridgeStatus`](../host-app/src/components/BridgeStatus.tsx#L6)                                                                                                                                     | log prefix `[scoring-viewer]` in the viewer console                                                                                                          |
| Entry point             | [`useScoringForm.ts`](../host-app/src/hooks/useScoringForm.ts) (`useChannel`, `channel.on` in an effect whose cleanup detaches it, Q-5)                                                              | [`getContextModule` → provider → `useScoringViewer`][fork-index]                                                                                             |

[fork-config]: ../packages/scoring-viewer/src/ScoringViewer.tsx#L22
[fork-index]: ../packages/scoring-viewer/src/hooks/useScoringViewer.ts
[fork-bridge-origin]: ../packages/channel/src/peer.ts#L37
[fork-bridge-post]: ../packages/channel/src/peer.ts#L17
[fork-bridge-ready]: ../packages/scoring-viewer/src/events/handlers.ts#L22
[fork-bridge-viewport]: ../packages/scoring-viewer/src/ohif/facade.ts#L84
[fork-bridge-map]: ../packages/scoring-viewer/src/commands/handlers.ts#L41
[fork-bridge-take]: ../packages/scoring-viewer/src/events/handlers.ts#L9
[fork-bridge-added]: ../packages/scoring-viewer/src/ohif/facade.ts#L81
[fork-bridge-added-post]: ../packages/scoring-viewer/src/events/handlers.ts#L11
[fork-bridge-throttle]: ../packages/scoring-viewer/src/ohif/throttle.ts
[fork-bridge-interval]: ../packages/scoring-viewer/src/ohif/facade.ts#L17
[fork-bridge-removed]: ../packages/scoring-viewer/src/ohif/facade.ts#L83
[fork-commands-guard]: ../packages/scoring-viewer/src/hooks/useScoringViewer.ts#L13
[fork-commands-snapshot]: ../packages/scoring-viewer/src/commands/handlers.ts#L7
[fork-commands-active]: ../packages/scoring-viewer/src/commands/handlers.ts
[fork-commands-disarm]: ../packages/scoring-viewer/src/commands/handlers.ts#L44
[fork-removals-remove]: ../packages/scoring-viewer/src/commands/handlers.ts#L52
[fork-focus]: ../packages/scoring-viewer/src/commands/handlers.ts#L35
[fork-metrics]: ../packages/scoring-viewer/src/ohif/metrics.ts
[fork-units]: ../packages/scoring-viewer/src/ohif/metrics.ts#L25
[fork-overlay]: ../packages/scoring-viewer/src/ohif/version.ts#L18

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
inside `ohif.on`, run by an effect of [`useScoringViewer`][fork-index] with the
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
2. Extension: one more row in `METRIC_SPECS` of [`ohif/metrics.ts`][fork-metrics] (the stats field and its unit table), the way `area` is read.
3. Host: `MeasurementRow` already renders the first non-area metric; to show both, map over the
   metrics object; `computeTotals(rows, 'mean')` gives the total.

**P-9. A protocol element is disabled (e.g. `VIEWER_READY`).** Symptoms: the
[status line](../host-app/src/components/BridgeStatus.tsx#L6) stays at `очікує VIEWER_READY`, the
queue count grows with each "Активувати", and the viewer console has no `[channel] sent VIEWER_READY`. Walk:
[VIEWPORT_ADDED subscription][fork-bridge-viewport] → [`VIEWER_READY` sent once][fork-bridge-ready] → host
[`readyOn` branch](../packages/channel/src/channel.ts#L88). If `ACTIVATE_TOOL` is disabled instead,
the queue drains but the viewer console has no `[channel] received ACTIVATE_TOOL` and the tool stays WindowLevel.

## Rehearsal checklist

- [ ] Both apps start from a clean clone by README only (`npm run viewer:link` first until the release is pinned in the fork).
- [ ] Three measurements in a row, total updates.
- [ ] Cancel: "Активувати", then "Скасувати" → row `Очікує`, tool back to WindowLevel.
- [ ] Drag an ellipse handle: the row value and total change while dragging.
- [ ] Add a length row, draw a line: it lands in that row in mm and the length total is separate.
- [ ] "Видалити" on a Done row removes the annotation; deleting it in OHIF returns the row to `Очікує`.
- [ ] Click a Done row: the viewer jumps to and selects the annotation.
- [ ] Reload the page with two measurements: rows, values, totals and both annotations come back.
- [ ] 2×2 layout: `OHIF 3.12.17` in every pane.
- [ ] P-7 swap to `RectangleROI` in under 2 minutes.
- [ ] P-9: comment out the `session.channel.send(event)` of the `VIEWER_READY` case in `events/handlers.ts`, reload, diagnose aloud.

## Video script (D-8, 2–4 min)

Read while recording. Steps and labels are as on screen; the narration is in the video's language,
Ukrainian, the way the form's strings are (A-7) — everything else here stays English.

**Before recording (off camera).** `npm run viewer:link` (until the release is pinned in the fork the
viewer must run the working-tree packages, or the published contract rejects every command);
`npm run viewer:dev` and wait for "compiled successfully"; `npm run dev --workspace host-app`. Open
the host's and the viewer's consoles in separate windows. Clear the host's sessionStorage
(DevTools → Application) so the form starts empty. Dismiss OHIF's "investigational use" banner and
answer "No" to "Track measurements?" once, before the take.

| Time      | What to show                                                                                                                    | Narration                                                                                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Two terminals with the running servers; open http://localhost:5173. Point at the status line before and after the viewer loads. | «Два застосунки на різних портах: форма на 5173, OHIF на 3000 в iframe. Спілкуються лише через postMessage з явним origin. Статус зверху — "очікує VIEWER_READY": форма нічого не шле, поки viewer не оголосить готовність. Ось він завантажився — "готовий, у черзі: 0".»                                                            |
| 0:20–1:20 | "Додати вимірювання" → "Активувати" → draw an ellipse; three times. Point at the value, the unit and "Разом (3 вимірювання)".   | «Кожен рядок отримує свій rowId ще до малювання. "Активувати" шле ACTIVATE_TOOL з іменем інструмента, viewer вмикає еліпс, а після вимірювання повертається до WindowLevel. Площа приходить у MEASUREMENT_ADDED разом із uid анотації — це єдина кореляція між сторонами. "Разом" — сума лише в mm²; px² до mm² ніколи не додається.» |
| 1:20–1:40 | "Додати вимірювання" → "Активувати" → "Скасувати". Point at the OHIF toolbar.                                                   | «Передумав: DEACTIVATE_TOOL, рядок повертається в "Очікує", інструмент — до WindowLevel. Рядок лишається, його можна активувати знову.»                                                                                                                                                                                               |
| 1:40–2:00 | Hover an ellipse, grab a handle, drag it slowly.                                                                                | «Живе оновлення: значення і сума міняються під час руху. Viewer проріджує MEASUREMENT_UPDATED до десяти на секунду; форма у відповідь нічого не шле, тому петлі немає.»                                                                                                                                                               |
| 2:00–2:20 | "Додати довжину" → "Активувати" → draw a line. Point at "Разом довжина".                                                        | «Другий інструмент їде тим самим полем toolName. Довжини сумуються окремо від площ.»                                                                                                                                                                                                                                                  |
| 2:20–2:35 | Pan the image away, then click a "Готово" row.                                                                                  | «Клік по рядку — FOCUS_MEASUREMENT: viewer стрибає до анотації і виділяє її.»                                                                                                                                                                                                                                                         |
| 2:35–3:00 | "Видалити" on one row; then right-click another ellipse in the viewer → "Delete measurement".                                   | «Видалення в обидва боки: з форми — анотація зникає у viewer-і; з viewer-а — рядок повертається в "Очікує", як сказано в завданні.»                                                                                                                                                                                                   |
| 3:00–3:15 | Switch the layout to 2×2 (toolbar grid button).                                                                                 | «OHIF 3.12.17 у кожній панелі — версія з package.json, підставлена webpack-ом під час збірки.»                                                                                                                                                                                                                                        |
| 3:15–3:35 | Press F5; wait for the viewer; point at the rows, the totals and the redrawn annotations.                                       | «Після перезавантаження рядки й суми на місці, а viewer отримує RESTORE_MEASUREMENTS і перемальовує анотації з тими самими uid. Значення підтверджує сам viewer, сховищу не довіряємо.»                                                                                                                                               |
| 3:35–3:50 | The host console: `[channel] received …` / `sent …` lines.                                                                      | «Весь протокол видно в консолі: перевірка origin, версія контракту, черга до VIEWER_READY. Контракт — zod-схеми в окремому пакеті, спільному для обох сторін.»                                                                                                                                                                        |

Tips: draw small ellipses right after "Активувати" and narrate over the actions, not between them.
If a step goes wrong, stop, press F5 and retake only that step — the state survives a reload.

## Known console noise (not ours)

Two warnings appear in the viewer's console in the development build of OHIF 3.12.17 and are
unrelated to the extension; a message of ours always starts with `[channel]` or `[scoring-viewer]`.

- `Warning: Failed prop type: Invalid prop `config`supplied to`App`, expected one of type [function]` — OHIF's
  own `App.propTypes` (`platform/app/src/App.tsx`), once per viewer load.
- `Warning: React does not recognize the `evaluateProps` prop on a DOM element` — OHIF's toolbar
  (`ToolbarService` adds the field to every button, `extensions/default` spreads it onto a `div`).
  `ScoringViewer` shows in that component stack only because our provider wraps the mode (A-32),
  like every other context-module provider.
