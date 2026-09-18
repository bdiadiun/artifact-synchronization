# A-14 — State restore: the form persists, the viewer rebuilds the annotations

Status: approved 2026-09-18. Canon: S-5.6, Q-3, Q-4, P-5.

## Context

After a reload the viewer starts empty: OHIF loads the study again and holds no annotation from the
previous page. The form, in contrast, can persist whatever it stores. Research
(`docs/notes/ohif-annotation-restore.md`) established three facts that shape the design:

- an annotation can be re-added with `annotation.state.addAnnotation(object)` and a supplied
  `annotationUID` is preserved, so a restored measurement keeps the id the form already stores;
- re-adding does not broadcast `MEASUREMENT_ADDED`; the value arrives later as
  `MEASUREMENT_UPDATED` once cornerstone recomputes the statistics in its render pass;
- the annotation mapper needs image metadata, which is ready at
  `cornerstoneViewportService` `VIEWPORT_DATA_CHANGED`, later than our readiness handshake.

## Decision

- **The form owns the saved state.** Rows, their tool, status, value and the geometry needed to
  rebuild the annotation are written to `sessionStorage` under a key that includes the
  `StudyInstanceUID`. Nothing is written by the viewer.
- **`sessionStorage`, not `localStorage`.** Each tab keeps its own state, which preserves the
  answer to P-5: two tabs never overwrite each other. Closing the tab clears it, which is the
  honest lifetime for an assignment without a backend (X-1).
- **The viewer rebuilds, the form asks.** After the handshake the form sends
  `RESTORE_MEASUREMENTS` with one entry per stored measurement. The bridge waits for
  `VIEWPORT_DATA_CHANGED`, seeds its `uid → rowId` map first, adds each annotation with the stored
  uid and `invalidated: true`, triggers an annotation render, and answers with
  `MEASUREMENTS_RESTORED` listing what was restored and what failed.
- **Values are confirmed by the viewer, not trusted from storage.** The restored row shows its
  stored value immediately, and the `MEASUREMENT_UPDATED` that follows the recompute replaces it.
  A row whose annotation could not be rebuilt is marked in the form instead of silently keeping a
  number with nothing behind it.
- **Only the same study.** A stored state for another `StudyInstanceUID` is ignored, because an
  annotation restored onto a different study would land on an image it does not belong to and
  disappear without an error.
- **Additive contract.** `RESTORE_MEASUREMENTS` and `MEASUREMENTS_RESTORED` are new message types
  and the measurement events carry the geometry the form has to persist; the shapes that exist stay
  untouched and the contract stays at `version: 1`.

## Rejected alternatives

- **Restoring only the form.** Cheap, but the assignment asks for the annotations as well, and a
  row with a value and no annotation behind it is worse than no restore at all.
- **Letting the viewer persist the annotations.** OHIF has no such storage of its own, and putting
  it there would make the viewer own state that belongs to the form.
- **Re-deriving ids after restore.** Possible, but a round trip to renumber rows is pure cost when
  the supplied uid is preserved.

## Consequences

- The form stores medical geometry in the browser; with a backend this belongs on the server
  together with the audit trail, and the note in `AI-USAGE.md` about the missing backend applies
  here too.
- A restored annotation on a slice the viewer is not showing is invisible until the user scrolls to
  it. That is OHIF's own filtering, not a defect of the restore.
- The bridge now depends on one more OHIF event (`VIEWPORT_DATA_CHANGED`), which is recorded in
  `docs/notes/ohif-annotation-restore.md`.
