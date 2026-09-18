// What each viewer event does to the form. Pure wiring around `dispatch`/`send`: the row state
// itself stays in the reducer, `useViewerEvents` decides *when* these run.

import type { Dispatch } from 'react';
import type {
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  RestoreMeasurementRequest,
} from '@scoring/contract';
import { STUDY_INSTANCE_UID } from '../config';
import { activateToolCommand, restoreMeasurementsCommand } from './commands';
import { FormActionType, RowStatus, type FormAction, type FormState, type Row } from './rows';
import { findRow, findRowByUid } from './selectors';
import type { ViewerEventHandlers } from './useViewerEvents';

export interface ViewerEventContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: (command: HostCommand) => void;
  // requestIds of the REMOVE_MEASUREMENT commands `useScoringForm` issued (A-10 echo guard); this
  // module only consumes them.
  issuedRemovalRequestIds: Set<string>;
  // Rows loaded from sessionStorage at mount (A-14); fixed for the session, independent of `state`.
  restoredRows: readonly Row[];
  // requestIds of the RESTORE_MEASUREMENTS commands issued below, matched against
  // MEASUREMENTS_RESTORED the same way `issuedRemovalRequestIds` matches REMOVE_MEASUREMENT.
  issuedRestoreRequestIds: Set<string>;
}

// Only a row with both a stored uid and its geometry can be re-added in the viewer (A-14); a row
// restored without geometry (older/corrupt storage) is silently left out rather than sent broken.
const restorableMeasurements = (rows: readonly Row[]): RestoreMeasurementRequest[] =>
  rows
    .filter(
      (row): row is Row & { measurementUid: string; geometry: NonNullable<Row['geometry']> } =>
        row.measurementUid !== null && row.geometry !== null,
    )
    .map((row) => ({
      rowId: row.rowId,
      measurementUid: row.measurementUid,
      toolName: row.toolName,
      geometry: row.geometry,
    }));

const sendRestoreIfNeeded = (context: ViewerEventContext): void => {
  const measurements = restorableMeasurements(context.restoredRows);
  if (measurements.length === 0) {
    return;
  }
  const requestId = crypto.randomUUID();
  context.issuedRestoreRequestIds.add(requestId);
  context.send(restoreMeasurementsCommand(requestId, STUDY_INSTANCE_UID, measurements));
};

// A reload means the viewer forgot any already-flushed command, so an armed row is re-sent. The
// first-ever READY needs no such re-send: an activation clicked before it is still queued in the
// bridge and flushed automatically (A-9). That first READY is instead when a page reload of the
// host itself is detected (A-14): if sessionStorage had rows, ask the viewer to rebuild them.
const handleViewerReady = (context: ViewerEventContext, isReload: boolean): void => {
  if (!isReload) {
    sendRestoreIfNeeded(context);
    return;
  }
  const { armedRowId, rows } = context.state;
  if (armedRowId === null) {
    return;
  }
  const armedRow = findRow(rows, armedRowId);
  if (armedRow === undefined) {
    return;
  }
  context.send(activateToolCommand(crypto.randomUUID(), armedRow.rowId, armedRow.toolName));
};

const handleMeasurementAdded = (
  context: ViewerEventContext,
  event: MeasurementAddedEvent,
): void => {
  // A-8: a measurement drawn while nothing is armed arrives with `rowId: null` and is dropped.
  if (event.rowId === null) {
    console.info('[form] measurement without an armed row ignored', event.measurementUid);
    return;
  }
  const row = findRow(context.state.rows, event.rowId);
  // The reducer already refuses this for a missing/non-`drawing` row; logged here so the
  // console shows *where* the no-op was decided.
  if (row?.status !== RowStatus.Drawing) {
    console.warn(
      '[form] measurement for a row that is not armed',
      event.rowId,
      event.measurementUid,
    );
    return;
  }
  context.dispatch({
    type: FormActionType.MeasurementReceived,
    rowId: event.rowId,
    measurementUid: event.measurementUid,
    metrics: event.metrics,
    geometry: event.geometry ?? null,
  });
};

const handleMeasurementUpdated = (
  context: ViewerEventContext,
  event: MeasurementUpdatedEvent,
): void => {
  const row = findRowByUid(context.state.rows, event.measurementUid);
  // Unknown uid is expected (a measurement drawn without an armed row), not an error.
  if (row?.status !== RowStatus.Done) {
    console.debug('[form] update for a measurement not tracked by any row', event.measurementUid);
    return;
  }
  // Only dispatches locally, never `send`: no command here for the viewer to echo (A-10).
  context.dispatch({
    type: FormActionType.MeasurementUpdated,
    measurementUid: event.measurementUid,
    metrics: event.metrics,
  });
};

const handleMeasurementRemoved = (
  context: ViewerEventContext,
  event: MeasurementRemovedEvent,
): void => {
  // A `causedBy` matching a requestId we issued is the echo of our own REMOVE_MEASUREMENT (the row
  // is already gone); ignore and forget it (A-10).
  const { issuedRemovalRequestIds } = context;
  if (event.causedBy !== undefined && issuedRemovalRequestIds.has(event.causedBy)) {
    issuedRemovalRequestIds.delete(event.causedBy);
    console.debug('[form] ignoring our own REMOVE_MEASUREMENT echo', event.measurementUid);
    return;
  }
  const row = findRowByUid(context.state.rows, event.measurementUid);
  if (row?.status !== RowStatus.Done) {
    console.debug('[form] removal for a measurement not tracked by any row', event.measurementUid);
    return;
  }
  context.dispatch({ type: FormActionType.MeasurementCleared, rowId: row.rowId });
};

// A-14: matched against the requestId `sendRestoreIfNeeded` recorded, the same way a
// REMOVE_MEASUREMENT echo is matched. An unmatched reply (foreign or duplicate) is ignored.
const handleMeasurementsRestored = (
  context: ViewerEventContext,
  event: MeasurementsRestoredEvent,
): void => {
  const { issuedRestoreRequestIds } = context;
  if (event.causedBy === undefined || !issuedRestoreRequestIds.has(event.causedBy)) {
    console.debug('[form] ignoring unmatched MEASUREMENTS_RESTORED', event.causedBy);
    return;
  }
  issuedRestoreRequestIds.delete(event.causedBy);
  for (const failure of event.failed) {
    context.dispatch({
      type: FormActionType.RestoreFailed,
      rowId: failure.rowId,
      reason: failure.reason,
    });
  }
};

export const createViewerEventHandlers = (context: ViewerEventContext): ViewerEventHandlers => ({
  onViewerReady: (isReload: boolean): void => {
    handleViewerReady(context, isReload);
  },
  onMeasurementAdded: (event: MeasurementAddedEvent): void => {
    handleMeasurementAdded(context, event);
  },
  onMeasurementUpdated: (event: MeasurementUpdatedEvent): void => {
    handleMeasurementUpdated(context, event);
  },
  onMeasurementRemoved: (event: MeasurementRemovedEvent): void => {
    handleMeasurementRemoved(context, event);
  },
  onMeasurementsRestored: (event: MeasurementsRestoredEvent): void => {
    handleMeasurementsRestored(context, event);
  },
});
