# A-4 — Cancelled activation keeps the row in `Pending`

Status: pending approval (2026-09-16). Canon: C-4.3.3, C-4.4.1, D-8 (d).

## Context
The assignment defines `DEACTIVATE_TOOL` ("cancel waiting for drawing") and requires the demo to
show "Activate clicked, then changed mind", but does not say what happens to the row.

## Decision
Cancelling sends `DEACTIVATE_TOOL` for that row; the viewer returns to the default tool; the row
returns from `Drawing…` to `Pending` and is kept, so it can be activated again or deleted.

## Rejected alternatives
- Deleting the row on cancel: surprising, and loses the row's identity.
- Leaving the row in `Drawing…`: the form and the viewer would disagree on the armed state.

## Consequences
- Only one row can be in `Drawing…` at a time; activating another row cancels the previous one.
