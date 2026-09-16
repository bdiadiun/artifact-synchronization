# Defence notes

Where to point during the call. Line numbers refer to the state at the time of writing; use the
symbol names if they drift.

## Questions (canon P-1..P-6)

| ID  | Question                                 | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1 | iframe loads slower than the user clicks | `host-app/src/bridge/createBridge.ts` — `send()` pushes to `queue` when not ready (~L132), `flushQueue()` on `VIEWER_READY` (~L71–80). Visible on screen: the status line shows `у черзі: N`. Demo: stop the viewer, click "Активувати", start the viewer, watch the queue drain.                                                                                                                                                                         |
| P-2 | Why `postMessage`                        | Two origins, one channel that the browser guarantees works across them and carries a verifiable `event.origin`. Same origin would allow direct `contentWindow` access (calling `services` on the iframe) or a `BroadcastChannel`; we would drop the origin checks but keep the contract, since a typed message boundary is still the seam between two deployables.                                                                                        |
| P-3 | Who issues the measurement id            | Viewer (`measurement.uid` = cornerstone `annotationUID`), host issues `rowId`. `viewer/extensions/scoring-bridge/src/bridge.ts` ~L161 (`uidToRowId.set`), `host-app/src/form/useScoringForm.ts` ~L28 (`crypto.randomUUID()`). Flipped: the host cannot create an empty `Pending` row before drawing, and an external id cannot be stored on an OHIF measurement (`_isValidMeasurement` rejects unknown keys), see `docs/decisions/A-8-id-correlation.md`. |
| P-4 | Where we subscribe in OHIF and why       | `bridge.ts` ~L175: `measurementService.subscribe(EVENTS.MEASUREMENT_ADDED)` inside `preRegistration`. The service collapses cornerstone `ANNOTATION_ADDED` + `ANNOTATION_COMPLETED` into one event on completion and returns an unsubscribe handle; raw cornerstone events would fire on the first click.                                                                                                                                                 |
| P-5 | Two host-app tabs                        | Each tab has its own iframe and its own `contentWindow`; `postMessage` is point to point, so tabs never see each other's messages. Only the bonus state-restore (S-5.6) would need per-tab keys.                                                                                                                                                                                                                                                          |
| P-6 | Where an infinite loop could arise       | `measurementService.update()` / `remove()` re-broadcast `MEASUREMENT_UPDATED` / `REMOVED` (`docs/notes/ohif-bridge-api.md` §6). In the mandatory part the host never sends a command in reaction to a `MEASUREMENT_*` event, so there is no cycle. The bonus path uses `requestId` → `causedBy` (`bridge.ts` ~L155) and idempotent commands (`commands.ts` ~L115).                                                                                        |

## Live changes (P-7..P-9)

| ID  | Change                                            | Steps                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-7 | Ellipse → `RectangleROI`                          | Edit `DEFAULT_TOOL` in `host-app/src/config.ts` (~L8). Nothing else: the tool name travels in `ACTIVATE_TOOL`, `commands.ts` checks `toolGroup.hasTool`, and `measurements.ts` already maps `RectangleROI` (same stats shape).                                                                                                                                                                                                     |
| P-8 | Add a field (e.g. mean intensity) end to end      | 1) `viewer/.../measurements.ts` `toMetrics`: add `mean: { value: stats.mean, unit: 'hu' }` (extend `Unit` in `packages/contract/src/messages.ts` and re-copy to the extension: `npm run check:contract` tells you when they differ). 2) Host: `MeasurementRow` shows every metric already (falls back to the first non-area metric); to show both, map over `Object.entries(metrics)`. 3) Optional: `computeTotals(rows, 'mean')`. |
| P-9 | A protocol element disabled (e.g. `VIEWER_READY`) | Symptoms: status line stays `очікує VIEWER_READY`, queue count grows on each "Активувати", viewer console has no `VIEWER_READY sent`. Walk: `bridge.ts` `postViewerReady` (~L67) → `toolGroupService` `VIEWPORT_ADDED` subscription (~L232) → host `createBridge.ts` ~L105. If `ACTIVATE_TOOL` is disabled instead: queue drains, but the viewer console shows no `armed row`, tool stays `WindowLevel`.                           |

## Rehearsal checklist

- [ ] Both apps start from a clean clone by README only.
- [ ] Three measurements in a row, total updates.
- [ ] Cancel: activate, then "Скасувати" → row `Очікує`, tool back to WindowLevel.
- [ ] P-7 swap to RectangleROI in under 2 minutes.
- [ ] P-9: comment out `window.parent.postMessage` in `postViewerReady`, reload, diagnose aloud.

## Video script (D-8, 2–4 min)

1. Terminal 1: `cd viewer && yarn --cwd platform/app dev`. Terminal 2: `npm run dev --workspace host-app`. Open http://localhost:5173. Point at the status line turning to `готовий`.
2. Click "Додати вимірювання" three times, activate row 1, draw an ellipse, watch the row and the total; repeat for rows 2 and 3.
3. Add a fourth row, activate, then "Скасувати": row returns to `Очікує`, the OHIF toolbar highlight returns to the previous tool.
4. Reload the viewer iframe while a row is armed (bonus of A-9): the row is re-armed automatically.
5. Any implemented bonus tasks.
