// What each viewer event does to the form. Pure wiring around `dispatch`/`send`: the row state
// itself stays in the reducer, `useViewerEvents` decides *when* these run.

import type {
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  RestoreMeasurementRequest,
} from '@bdiadiun/scoring-contract';
import { studyInstanceUid } from '@app/config';
import type { ViewerEventHandlers } from '@app/hooks/useViewerEvents';
import { findRow, findRowByUid } from '@app/utils/selectors';
import { FormActionType, RowStatus, type Row } from './rows';
import { warnUnanswered } from './unanswered';
import type { ViewerEventContext } from './viewerEventHandlers.props';

export type { ViewerEventContext } from './viewerEventHandlers.props';

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

// A-14: a row the viewer refused is marked from the answer to our own request, which the exchange
// hands back here; no reply of anyone else's can reach this code.
const dispatchRestoreFailures = (
  context: ViewerEventContext,
  answer: MeasurementsRestoredEvent,
): void => {
  for (const failure of answer.failed) {
    context.dispatch({
      type: FormActionType.RestoreFailed,
      rowId: failure.rowId,
      reason: failure.reason,
    });
  }
};

const sendRestoreIfNeeded = (context: ViewerEventContext): void => {
  const measurements = restorableMeasurements(context.restoredRows);
  if (measurements.length === 0) {
    return;
  }
  void context
    .exchange('RESTORE_MEASUREMENTS', { studyInstanceUid: studyInstanceUid(), measurements })
    .then((answer) => {
      dispatchRestoreFailures(context, answer);
    })
    .catch(warnUnanswered);
};

// A viewer reload forgot any flushed command, so an armed row is re-sent; on the first READY an
// early activation is still queued in the bridge and flushes itself (A-9). That first READY is
// instead where a reload of the host is answered with a restore request (A-14).
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
  context.send('ACTIVATE_TOOL', { rowId: armedRow.rowId, toolName: armedRow.toolName });
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
  // The echo of our own REMOVE_MEASUREMENT never arrives here: it answers the exchange that asked
  // for it (A-10, A-21). What reaches this handler was deleted in the viewer.
  const row = findRowByUid(context.state.rows, event.measurementUid);
  if (row?.status !== RowStatus.Done) {
    console.debug('[form] removal for a measurement not tracked by any row', event.measurementUid);
    return;
  }
  context.dispatch({ type: FormActionType.MeasurementCleared, rowId: row.rowId });
};

// The answer to our own RESTORE_MEASUREMENTS is consumed by the exchange, so anything arriving as an
// event is a duplicate or a reply to a request this session never made (A-21).
const handleMeasurementsRestored = (event: MeasurementsRestoredEvent): void => {
  console.debug('[form] ignoring unmatched MEASUREMENTS_RESTORED', event.causedBy);
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
    handleMeasurementsRestored(event);
  },
});
