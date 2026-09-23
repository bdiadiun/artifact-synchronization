# A-33 — what the review of the boundaries refactor changed

Status: approved 2026-09-23; items 1, 4 and 5 superseded the same day by
[A-34](A-34-two-applications-one-channel-hook.md). Canon: C-3.4, C-4.3.5, Q-1, Q-2, Q-5, S-5.6.
Amends [A-27](A-27-folder-layout.md), [A-29](A-29-channel-is-transport.md),
[A-31](A-31-one-channel.md), [A-32](A-32-react-bridge.md). Related: [A-14](A-14-state-restore.md).

## Context

A review of the working tree of slice 61 (the boundaries refactor, A-26..A-32) found five
behaviour defects, two rule texts that disagreed with each other and with the code, and one canon
sentence the code no longer met to the letter. Each fix below is the smallest change that keeps
the shape of A-27..A-32; where a fix reverses a bullet of an earlier record, that record carries
an "amended 2026-09-23" note pointing here.

## Decision

1. **`VIEWER_READY` is handled where it arrives.** The form's one message handler, re-registered
   whenever the rows change, offers the rows on screen to a viewer that has just announced itself
   and then dispatches the event; the channel's `announcements` counter is gone and `ChannelState`
   is `{ ready, queued }`. The counter version read `sessionStorage` instead of the rows in memory
   (an empty or stale restore whenever storage failed or lagged) and, being a level rather than an
   edge, replayed the restore on every remount of the hook. Amends A-29 (3) and A-31. (The
   handler's shape is now A-34's: `channel.on`, and the restore goes through `dispatch`.)
2. **`MEASUREMENT_UPDATED` keeps the geometry it carries.** A dragged handle sends new points; the
   reducer stores them with the new metrics, so the next restore rebuilds the shape the user left,
   not the one first drawn (S-5.6, A-14).
3. **A restore mark is cleared when it stops being true**: when the viewer reports the row
   restored, when the viewer removes the measurement, and when a new measurement arrives for the
   row.
4. **A viewer opened outside the iframe has no peer window** (see A-32, amended). The
   "one effect creates and disposes the bridge" part of this item lasted a day: A-34 replaced it
   with the module-level channel end and `useChannel`.
5. **`viewer:link` links our packages and nothing else** (see A-32, amended). The "channel
   package without React" part of this item was reversed by A-34: the package now owns the one
   React binding, `useChannel`, for both applications.
6. **C-3.4 is met through `getContextModule`** (see A-32); the canon keeps the assignment's
   wording and this entry records the reading.
7. **The contract loses `invalid-geometry`** from `RestoreFailureReason`: no viewer version ever
   produced it (the geometry is validated by the host's stored-row schema before it is sent), so
   the enum now lists only what the bridge reports — `already-present`, `unknown-study`,
   `viewer-error`. A newer host refuses a `MEASUREMENTS_RESTORED` carrying the old value; none is
   ever sent. Contract 0.0.14.
8. **The stored envelope names its key `studyInstanceUid`**, as the hook does; `uuid` misnamed a
   DICOM Study Instance UID and broke the rows a previous build had stored.
9. **The lint globs cover `packages/*/src/**/*.tsx`**, so the bridge's component and hook are
   checked by the same rules as the application's; the Vitest include collects `*.test.tsx` from
   the packages too.
10. **A-27's size rule reads the same in both places**: no file under twenty lines, except a
    package `index.ts`, `main.tsx`, a component's `.props.ts` and a file the standard layout
    names (`hooks/useChannel.ts`, `state/selectors.ts`, `services/channel.ts`, a page). The
    selectors import only the `Row` type from the reducer, so the two files no longer form a
    cycle; the drawing-row lookup lives at its one caller.

## Why this way

Each defect was a place where the shape (A-27..A-32) had been kept but its promise had not: the
restore promised "the rows on screen", the geometry promised "what the viewer holds", the effect
promised "its cleanup unsubscribes what it subscribed". Fixing the promise inside the shape costs
a few lines; replacing the shape would have reopened the refactor.
