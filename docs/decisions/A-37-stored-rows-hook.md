# A-37 — the stored rows are a hook, and the model issues the row id

Status: approved 2026-09-23. Canon: S-5.6 (A-14), Q-3 (A-8). Related: [A-35](A-35-abstract-storage.md),
[A-36](A-36-row-model-folder.md).

## Context

After A-35 and A-36 the rows' persistence sat in `services/storedRows.ts` as two functions, and the
row id was drawn in the action creator and passed into `RowModel.create`. The author asked for the
persistence to be a hook that works with the storage service — without mixing the reducer into it
— and for the model to issue the id of the row it creates.

## Decision

- **`hooks/useStoredRows(studyInstanceUid)` → `[storedRows, save]`**: the rows read from
  `sessionStorage` once, at mount (`useState` with a lazy initializer over `loadRows`), and a
  stable `save(rows)` that writes them back (`saveRows`). The envelope
  `{ studyInstanceUid, rows: RowModel.jsonSchema[] }` and the key live in the same module; the
  generic service (A-35) stays the only thing that touches `sessionStorage`.
- **`useScoringForm` composes**: `useChannel`, then `useStoredRows`, then
  `useReducer(reducer, storedRows)`; the effect that saves on every change is written in the form
  hook, where the change happens (§0.2). The reducer is not the hook's business.
- **`RowModel.create(toolName)` issues `rowId`** (`crypto.randomUUID()`); the local action is
  `{ type: 'ADD_ROW', row }` and the reducer appends the row it is given. A-8 holds: the host
  issues the row id before any drawing — now in the model, not in the action creator.
- `loadRows` / `saveRows` stay exported from the hook's module for the existing envelope tests
  (an export only a test imports — a known exception until the test slice rewrites them through
  the hook).

## Why this way

A hook that returns what its name promises — the stored rows and the way to store them — and a
form hook that reads as three lines of composition. Rejected: a `useStoredRows` that owns the
reducer (persistence and transitions in one hook); leaving two functions in `services/` (the author
wanted the instrument to be a hook); generating the id in the reducer (a reducer is pure).
