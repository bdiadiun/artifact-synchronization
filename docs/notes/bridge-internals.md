# Bridge internals

Implementation details of the bridge that are deliberate but not visible from the code alone.
Decisions live in [`docs/decisions/`](../decisions/); OHIF behaviour we rely on is in
[`ohif-bridge-api.md`](ohif-bridge-api.md). File names below refer to
`packages/viewer-bridge/src/` unless a path is given. Since the bridge was split by role,
`bridge.ts` is the composition root; messaging, handshake, the measurement stream and the reported
measurement state each live in their own module.

## Lifecycle

- **Disposed on `pagehide`, not `onModeExit`** (`index.tsx`). The bridge must outlive OHIF mode
  changes, because the host keeps talking to the same iframe, and extensions have no unregister
  hook. The page lifetime is the only correct scope.
- **`dispose()` disarms first** (`bridge.ts`, composition root). The doctor's previous tool is restored before the
  listeners and subscriptions go away, so closing the viewer never leaves the ellipse tool armed.
- **Missing `toolGroupService` means `VIEWER_READY` is sent immediately** (`handshake.ts`). Without
  the cornerstone extension there is no viewport signal to wait for. The risk is accepted and
  logged: commands may then arrive before a viewport exists and `setToolActive` would no-op.

## Measurements

- **Stats lookup** (`measurements.ts`). `measurement.data` is keyed by target; the entry
  `imageId:<referencedImageId>` is preferred, otherwise the first entry with a finite value.
- **No metrics on `MEASUREMENT_ADDED` means nothing is posted** (`measurementStream.ts`). A half-formed event
  would move the row to `Готово` without a value; staying silent leaves it in `Малювання…` where
  the doctor can cancel or redraw.
- **`MEASUREMENT_UPDATED` only for measurements bound to a row** (`measurementStream.ts`). Annotations drawn
  from the OHIF toolbar or restored from elsewhere never reached the form as a row, so their
  updates are not streamed.
- **Quiet mapping during drags** (`measurements.ts`). On the update path `toMetrics` logs at debug
  level: cornerstone fills `cachedStats` in its render pass, so intermediate drag frames without
  stats are normal, not errors.

## Commands

- **Every command goes through one handler map** (`channel.onEach` in `bridge.ts`, checked with `satisfies`; A-22 replaced the bridge's own registry). A new
  capability is a registered handler, not a new branch, so the fork does not change when the
  adapter grows. The registration map carries a `satisfies` clause against the contract's union of
  command types, so a command added to the contract without a handler fails the type check; that is
  what the old `default` branch narrowing to `never` used to provide. An unknown command type
  arriving at runtime is logged once per type and ignored, because a newer host may know commands
  this viewer does not.
- **Removal forgets the uid even when the measurement is already gone** (`removals.ts`). A stale
  `uid → rowId` entry must not outlive the host's state; the second `REMOVE_MEASUREMENT` for the
  same uid is a no-op that still cleans up.

## Host side

- **No separate `uid → rowId` map on the host** (`host-app/src/form/useScoringForm.ts`). A `done`
  row stores its own `measurementUid`, and `MEASUREMENT_ADDED` carries `rowId`, so the rows array
  is the map. Only the viewer keeps an explicit map, because OHIF's `MEASUREMENT_REMOVED` delivers
  just the uid.
