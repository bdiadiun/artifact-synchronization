# Bridge internals

Implementation details of the bridge that are deliberate but not visible from the code alone.
Decisions live in [`docs/decisions/`](../decisions/); OHIF behaviour we rely on is in
[`ohif-bridge-api.md`](ohif-bridge-api.md). File names below refer to
`viewer/extensions/scoring-bridge/src/` unless a path is given.

## Lifecycle

- **Disposed on `pagehide`, not `onModeExit`** (`index.tsx`). The bridge must outlive OHIF mode
  changes, because the host keeps talking to the same iframe, and extensions have no unregister
  hook. The page lifetime is the only correct scope.
- **`dispose()` disarms first** (`bridge.ts`). The doctor's previous tool is restored before the
  listeners and subscriptions go away, so closing the viewer never leaves the ellipse tool armed.
- **Missing `toolGroupService` means `VIEWER_READY` is sent immediately** (`bridge.ts`). Without
  the cornerstone extension there is no viewport signal to wait for. The risk is accepted and
  logged: commands may then arrive before a viewport exists and `setToolActive` would no-op.

## Measurements

- **Stats lookup** (`measurements.ts`). `measurement.data` is keyed by target; the entry
  `imageId:<referencedImageId>` is preferred, otherwise the first entry with a finite value.
- **No metrics on `MEASUREMENT_ADDED` means nothing is posted** (`bridge.ts`). A half-formed event
  would move the row to `Готово` without a value; staying silent leaves it in `Малювання…` where
  the doctor can cancel or redraw.
- **`MEASUREMENT_UPDATED` only for measurements bound to a row** (`bridge.ts`). Annotations drawn
  from the OHIF toolbar or restored from elsewhere never reached the form as a row, so their
  updates are not streamed.
- **Quiet mapping during drags** (`measurements.ts`). On the update path `toMetrics` logs at debug
  level: cornerstone fills `cachedStats` in its render pass, so intermediate drag frames without
  stats are normal, not errors.

## Commands

- **`default` branch kept in the command dispatch** (`commands.ts`). It narrows to `never`, so a
  new host command added to the contract but not handled here fails the type check.
- **Removal forgets the uid even when the measurement is already gone** (`removals.ts`). A stale
  `uid → rowId` entry must not outlive the host's state; the second `REMOVE_MEASUREMENT` for the
  same uid is a no-op that still cleans up.

## Host side

- **No separate `uid → rowId` map on the host** (`host-app/src/form/useScoringForm.ts`). A `done`
  row stores its own `measurementUid`, and `MEASUREMENT_ADDED` carries `rowId`, so the rows array
  is the map. Only the viewer keeps an explicit map, because OHIF's `MEASUREMENT_REMOVED` delivers
  just the uid.
