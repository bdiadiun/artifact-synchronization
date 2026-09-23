# A-35 — the storage service knows nothing about studies or rows

Status: approved 2026-09-23. Canon: S-5.6 (A-14), Q-7. Related: [A-14](A-14-state-restore.md),
[A-27](A-27-folder-layout.md), [A-28](A-28-boundaries-as-schemas.md).

## Context

`services/storage.ts` held both halves of persistence: the defensive access to `sessionStorage`
and the form's own knowledge — the key `scoring-form:rows:<study>`, the stored-row schema, the
mapping to and from `Row[]`. A service that knows what a row is is half of the form, and the author
asked for the service to be abstract.

## Decision

- **`services/storage.ts` is `sessionStorage` and nothing else**: `readStorage(key, schema)` returns
  the stored value once it passed the caller's zod schema, or `null` (nothing stored, a value the
  schema refuses, or a store that throws — private mode, a full quota, cleared site data — each
  logged as a warning); `writeStorage(key, value)` stores the value or warns. The type parameter is
  inferred from the schema; no caller writes it.
- **What the form stores lives in the form's state**: `state/storedRows.ts` holds the stored-row
  schema (`Row` without `restoreFailureReason`, A-14), the envelope `{ studyInstanceUid, rows }`,
  the key, and the two functions the hook uses — `loadRows(studyInstanceUid)` (the rows under that
  study, each starting with a clean restore attempt; `[]` otherwise) and
  `saveRows(studyInstanceUid, rows)`.
- Names: `loadRows` / `saveRows` say what the form does; `readStorage` / `writeStorage` say what the
  service does. The `__tests__` of the envelope move with it to `state/__tests__/storedRows.test.ts`.

## Why this way

The boundary rule (A-28) says a foreign value passes through one schema where it enters; the
service now applies whatever schema it is handed and the form owns its own. Rejected: keeping one
module and renaming it (the service would still import `Row`), and a generic storage class with
methods per key (a factory for two functions).
