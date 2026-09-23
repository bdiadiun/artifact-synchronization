# A-36 — the row model has its own folder

Status: approved 2026-09-23. Canon: Q-7, D-2. Related: [A-27](A-27-folder-layout.md),
[A-35](A-35-abstract-storage.md).

## Context

`Row` and `RowStatus` lived in `state/reducer.ts`, so every component and helper imported the
type of a row "from the reducer", and the stored form of a row (`StoredRows`) lived in the
persistence module. The author asked for what a row _is_ to be separate from how it changes and
how it is stored.

## Decision

- **`models/row.ts` is the row, with its API as one named object.** `RowStatus`, the `Row` type
  and `RowModel = { jsonSchema, create, toJSON, fromJSON, toRestoreRequest }`: the row's JSON form (every field but `restoreFailureReason`, A-14), a new pending row, the
  conversions to and from the JSON form, and the row as a `RestoreMeasurementRequest` (or `null`
  when it has no uid or geometry). Plain functions declared above and listed by name — the
  readability of static methods without a class (the strict lint set refuses a class with only
  static members, and §2 keeps arrow functions everywhere). Nothing in it depends on the reducer
  or on storage.
- **`state/reducer.ts` is how a row changes**: `FormAction` and the transitions; `ADD_ROW` is
  `RowModel.create`. **`services/storedRows.ts` is how rows are stored** (the rows' I/O adapter, A-35): the envelope
  `{ studyInstanceUid, rows: RowModel.jsonSchema[] }`, the key, `loadRows` (`RowModel.fromJSON`)
  and `saveRows` (`RowModel.toJSON`), over the storage service (A-35). `restoreViewer` maps the
  rows with `RowModel.toRestoreRequest`.
- Components, `utils/`, `state/actions.ts`, `state/selectors.ts` and the tests import `Row` /
  `RowStatus` / `RowModel` from `@app/models/row`; `FormAction` and `reducer` still come from the
  reducer.
- `models/` joins the layout of A-27 as a role folder ("what the data is"); other schemas keep
  their owners — the wire's in the contract package, OHIF's measurement object in
  `ohif/metrics.ts`.

## Why this way

One file answers "what is a row" and "how does it become its neighbours" for a reader coming from
the components, and the reducer file reads as transitions only; `RowModel.` in the editor lists the
whole API. Rejected: a `schemas/` folder (grouping by kind, which A-27 avoids; it would have had to
take `Row` out of the reducer anyway); leaving `Row` in the reducer with the stored form beside it
(the persistence module would keep a schema it does not own); a `class RowModel` with static
methods (same call sites, but a lint exception and a convention amendment for a namespace).
