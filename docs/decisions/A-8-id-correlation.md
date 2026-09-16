# A-8 — ID correlation: host issues `rowId`, viewer issues `measurementUid`

Status: approved 2026-09-16. Canon: Q-3, C-4.3.5, C-4.3.6, P-3.

## Context
Each form row and each annotation need an identifier, and the assignment asks who issues which.
OHIF facts (see `docs/notes/ohif-bridge-api.md`): a measurement's `uid` is the cornerstone
`annotationUID`, stable across ADDED / UPDATED / REMOVED; `_isValidMeasurement` rejects any
custom top-level field, so an external ID cannot be stored on the measurement; `label` is
user-editable in the OHIF panel.

## Decision
- The host creates a row with a UUID `rowId` before anything is drawn (needed for C-4.3.2).
- `ACTIVATE_TOOL { rowId, toolName }` arms the bridge: `pendingRowId = rowId`.
- On `MEASUREMENT_ADDED` from OHIF the bridge emits `{ rowId: pendingRowId, measurementUid: uid, ... }`,
  stores `uid → rowId` in its own map, and clears `pendingRowId`.
- `MEASUREMENT_UPDATED` / `MEASUREMENT_REMOVED` carry `measurementUid`; both sides resolve the row
  through their map (the viewer must keep one too, because REMOVED delivers only the uid string).
- A measurement created while nothing is armed (drawn from the OHIF toolbar) is forwarded with
  `rowId: null`; the host logs and ignores it.
- Before activating a tool the bridge snapshots the active primary tool
  (`toolGroupService.getActivePrimaryMouseButtonTool()`) and restores it after the measurement or
  on `DEACTIVATE_TOOL`. In the longitudinal mode that tool is WindowLevel; the assignment's
  "Pan/default" is read as "whatever was active before".

## Rejected alternatives
- Viewer issues the row ID: the form could not show an empty `Pending` row before drawing.
- Host issues the measurement UID: requires reaching into the cornerstone annotation manager and
  fighting `_isValidMeasurement`; brittle across OHIF upgrades.
- Carrying `rowId` in `label`: survives validation but the user can edit it in the OHIF panel.

## Consequences
- Only one row can be armed at a time; arming another row cancels the previous one (A-4).
- If the decision were flipped (P-3), C-4.3.2 breaks and the bridge would need write access to
  cornerstone internals.
