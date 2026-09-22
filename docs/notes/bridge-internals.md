# Bridge internals

Implementation details of the bridge that are deliberate but not visible from the code alone.
Decisions live in [`docs/decisions/`](../decisions/); OHIF behaviour we rely on is in
[`ohif-bridge-api.md`](ohif-bridge-api.md). File names below refer to
`packages/viewer-bridge/src/` unless a path is given. Since A-23 the extension is six modules:
`extension.ts` (composition root), `commands.ts`, `measurements.ts`, `restore.ts`, `throttle.ts`
and `ohif.ts`; announcing, the armed row and replies are the channel's (`packages/channel/src/viewerChannel.ts`).

## Lifecycle

- **Disposed on `pagehide`, not `onModeExit`** (`extension.ts`). The bridge must outlive OHIF mode
  changes, because the host keeps talking to the same iframe, and extensions have no unregister
  hook. The page lifetime is the only correct scope.
- **`dispose()` returns to the default tool first** (`extension.ts`). `WindowLevel` is activated
  before the listeners and subscriptions go away, so closing the viewer never leaves the ellipse
  tool armed (A-23: no snapshot of the previous tool any more).
- **Missing `toolGroupService` means `VIEWER_READY` is announced immediately** (`extension.ts`). Without
  the cornerstone extension there is no viewport signal to wait for. The risk is accepted and
  logged: commands may then arrive before a viewport exists and `setToolActive` would no-op.

## Measurements

- **Stats lookup** (`measurements.ts`). `measurement.data` is keyed by target; the entry
  `imageId:<referencedImageId>` is preferred, otherwise the first entry with a finite value.
- **No metrics on `MEASUREMENT_ADDED` means nothing is posted** (`measurements.ts`). A half-formed event
  would move the row to `Готово` without a value; staying silent leaves it in `Малювання…` where
  the doctor can cancel or redraw.
- **`MEASUREMENT_UPDATED` goes out for every annotation** (`measurements.ts`), throttled per uid;
  the form ignores a uid no row holds, so the extension keeps no `uid → rowId` map (A-23).
- **Silent mapping during drags** (`measurements.ts`). On the update path a measurement without
  stats is skipped without a log: cornerstone fills `cachedStats` in its render pass, so
  intermediate drag frames without stats are normal.

## Commands

- **Every command goes through one handler map** (`commands.ts`, registered with `channel.onEach`
  and checked with `satisfies MessageHandlers<HostCommand>`): a command added to the contract
  without a handler fails the type check, and an unknown type never reaches dispatch because the
  contract guard rejects it on arrival.
- **A removal is answered even when the measurement is already gone** (`commands.ts`):
  `channel.reply(command, …)` at once, so the host's exchange settles instead of timing out; a
  present measurement is removed and answered from the OHIF `MEASUREMENT_REMOVED` subscription.

## Host side

- **No separate `uid → rowId` map on the host** (`host-app/src/form/useScoringForm.ts`). A `done`
  row stores its own `measurementUid`, and `MEASUREMENT_ADDED` carries `rowId`, so the rows array
  is the map. The viewer keeps no map either since A-23; the channel remembers only the armed row, and
  a removal is correlated through the pending `REMOVE_MEASUREMENT` command.
