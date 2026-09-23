# Form internals

What the form's code does on purpose but cannot say by itself, module by module. The code carries
no comments (CONVENTIONS §8, A-24; the same rule as the packages since 2026-09-23); the reasons
live here and in [`docs/decisions/`](../decisions/). File names refer to `host-app/src/`.

## `config.ts`

- `VIEWER_ORIGIN` is the only origin accepted for incoming viewer messages (A-2); `VIEWER_CHANNEL`
  names the viewer as the page's one peer for every `useChannel` call, and `readyOn: 'VIEWER_READY'`
  holds commands back until the viewer's own announcement names its window (A-9, A-34).
- `DEFAULT_TOOL` is the single edit point for the ellipse → RectangleROI live change (P-7);
  `LENGTH_TOOL` is the bonus second tool (S-5.4).
- The study comes from the form's own `study` query parameter, read once per page load (the page
  has no routing, so the study cannot change while it is open), and falls back to
  `FALLBACK_STUDY_INSTANCE_UID` when the parameter is missing or invalid (A-19). A value is
  accepted only if it matches the DICOM UID grammar — dot-separated numeric components, at most
  64 characters (PS3.5 §9.1) — because it ends up inside the viewer iframe `src`: a free-form
  value could append its own query parameters or repoint the path, so it is rejected, not escaped.
  A rejected parameter is reported once, not on every render.

## `models/row.ts`

- `geometry` is kept on a row so a restored row can be re-sent to the viewer, and
  `restoreFailureReason` marks a row the viewer refused, which `MeasurementRow` shows next to a
  value that has no annotation behind it (A-14).
- The JSON form (`RowModel.jsonSchema`, `toJSON`, `fromJSON`) drops `restoreFailureReason`, so a
  reload always starts with a clean restore attempt rather than replaying a stale failure.
- `RowModel.create(toolName)` issues the row id (A-8, A-37). `toRestoreRequest` is `null` for a row
  without both a stored uid and its geometry: only such a row can be re-added in the viewer (A-14).

## `state/reducer.ts`

- The reducer is pure and side-effect-free; `hooks/useScoringForm.ts` wires it to the channel.
  Its actions are the two local ones, every command the form sends and every event the viewer
  sends — they go through as they are, so the reducer is the one place that says what each of them
  means for the form (A-30, A-34).
- Only one row is armed at a time (A-4): `ACTIVATE_TOOL` starts the target drawing and returns any
  other drawing row to pending; arming the row that already draws changes nothing.
- A measurement drawn while nothing was armed arrives with `rowId: null` and changes nothing (A-8).
- A deletion in the viewer "clears" the row back to pending rather than removing it (the
  assignment's wording); the viewer names the uid and the row is looked up by it (A-8). The echo of
  a removal the form asked for finds no row and changes nothing (A-30).
- `MEASUREMENTS_RESTORED` is applied row by row: a row the viewer rebuilt loses its mark, a row it
  refused keeps one, so the form can say the value has no annotation behind it (A-14, A-33).

## `state/actions.ts`

- What each button does to its row is one dispatch of a contract command or a local action; the
  form's `dispatch` sends the command and reduces it (A-34).
- `activateRow`: one row is armed at a time, and `ACTIVATE_TOOL` replaces the armed row on both
  sides, so no deactivation of the previous one is sent (A-4).
- `removeRow`: a drawing row is cancelled in the viewer first; a done row has its annotation
  removed there; the viewer's `MEASUREMENT_REMOVED` then comes back for a row that is already
  gone, and the reducer ignores a uid no row holds (A-30).
- `focusRow`: only a done row has a real annotation to scroll to; no reply is expected (S-5.3).
- `restoreViewer`: every `VIEWER_READY` is a viewer that has none of our annotations yet, so the
  rows it can rebuild are offered again (A-14, S-5.6) and the row that was drawing is armed again;
  at most one row is drawing at a time (A-4), so the armed row is read off the rows rather than
  mirrored anywhere.

## `state/selectors.ts`

- The viewer owns measurement ids, so an incoming event is matched by uid, not by row id (A-8).

## `hooks/useScoringForm.ts`, `hooks/useStoredRows.ts`

- The form for one study and the page's end of the channel. The rows come from `useStoredRows`
  once, as the reducer's initial state, and are written back through it on every change (A-14);
  `dispatch` sends every action that is a command of the contract and reduces all of them, so
  nothing else in the form talks to the viewer (A-30); the handler is re-registered whenever the
  rows change, so a viewer that announces itself is offered the rows on screen — a page reload and
  a viewer reload restore the same way (S-5.6, A-33).
- `useStoredRows` reads the rows of the study from `sessionStorage` once, at mount, and returns
  the way to write them back (A-37). `loadRows` accepts only a validated envelope under this exact
  study; anything else is "nothing to restore".

## `services/storage.ts`

- Every `sessionStorage` access is defensive: private mode, a full quota or a cleared store throw
  or return nothing, and the caller still has to render. What is stored and under which key is
  the caller's; the value read back passes through the caller's schema once (A-14, A-35).

## `components/`

- `ViewerFrame`: no `sandbox` attribute — the viewer needs its own scripts and must be able to
  `postMessage` out.
- `BridgeStatus`: a diagnostic surface for the handshake and the queue (P-9), not a product
  feature.
- `MeasurementRow`: native elements and minimal grey styling (X-3: no design work required). The
  row div becomes a button only while the row is focusable — a done row with an annotation to
  focus (S-5.3) — so neither handler re-checks the status; `stopPropagation` on the buttons keeps
  a click from also triggering the row's focus click. The restore-failure marker stands out from
  the grey status text so a failed restore is not missed (A-14).
- `TotalsFooter`: totals are grouped strictly by unit (A-11, Q-6); the primary unit takes the
  labelled line and any other unit (px²/px, an image without pixel spacing) gets its own line
  with a hint, rather than being dropped or added into a sum it does not belong to.

## `utils/`

- `format.ts`: a row shows the metrics its tool lists in `METRIC_KEYS_BY_TOOL`, in that order,
  joined by `·` (A-40); the first key of the list is the row's own metric — it names the row
  kind (S-5.4) and it is the key the totals are asked for — so a metric added to a list later is
  shown on the row without entering a total by accident (P-8).
- `totals.ts`: per-unit sums for the footer (A-11); mm² and px² are never added together, and mm²
  comes first because it is the clinically meaningful unit when the study carries pixel spacing.

## `i18n.ts`

- User-visible strings are Ukrainian (A-7) and live in one place; a real i18n library is out of
  scope (X-3). The "вимірювання" count follows Ukrainian noun agreement: 1 and 2–4 keep that form,
  5+ and 11–14 take "вимірювань". The restore-failure string is shown on a row whose annotation
  could not be rebuilt after a reload (A-14).

## `setup-tests.ts`

- Global DOM teardown so component test files do not each need their own `afterEach(cleanup)`;
  `sessionStorage` persists across `it` blocks within one file's jsdom instance, so it is cleared
  here so one test's persisted rows never leak into the next.
