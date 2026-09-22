// What each viewer event does to the form. Pure wiring around `dispatch` and the channel: which
// rows change is the reducer's decision, and it is the reducer that ignores an event for a row that
// is not drawing or a uid no row holds.

import type {
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  RestoreMeasurementRequest,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import { studyInstanceUid } from '@app/config';
import { findDrawingRow, FormActionType, type FormContext, type Row } from './rows';
import { activateTool, warnUnanswered } from './rowActions';

export interface ViewerEventHandlersDeps {
  // Read at call time, not at registration: the handlers are registered once per channel and have
  // to see the state of the render that is current when an event arrives.
  getContext: () => FormContext;
  // Rows loaded from sessionStorage at mount (A-14); fixed for the session, independent of `state`.
  restoredRows: readonly Row[];
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

// A-14: a row the viewer refused is marked from the answer to our own request, which the exchange
// hands back here; no reply of anyone else's can reach this code.
const dispatchRestoreFailures = (context: FormContext, answer: MeasurementsRestoredEvent): void => {
  for (const failure of answer.failed) {
    context.dispatch({
      type: FormActionType.RestoreFailed,
      rowId: failure.rowId,
      reason: failure.reason,
    });
  }
};

const dispatchMeasurementAdded = (context: FormContext, event: MeasurementAddedEvent): void => {
  // A-8: a measurement drawn while nothing is armed arrives with `rowId: null` and is dropped.
  if (event.rowId === null) {
    console.info('[form] measurement without an armed row ignored', event.measurementUid);
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

// Only dispatches locally, never sends: no command here for the viewer to echo (A-10).
const dispatchMeasurementUpdated = (context: FormContext, event: MeasurementUpdatedEvent): void => {
  context.dispatch({
    type: FormActionType.MeasurementUpdated,
    measurementUid: event.measurementUid,
    metrics: event.metrics,
  });
};

// The echo of our own REMOVE_MEASUREMENT never arrives here: it answers the exchange that asked for
// it (A-10, A-21). What reaches this handler was deleted in the viewer.
const dispatchMeasurementCleared = (context: FormContext, event: MeasurementRemovedEvent): void => {
  context.dispatch({
    type: FormActionType.MeasurementCleared,
    measurementUid: event.measurementUid,
  });
};

const requestRestore = (context: FormContext, restoredRows: readonly Row[]): void => {
  const measurements = restorableMeasurements(restoredRows);
  if (measurements.length === 0) {
    return;
  }
  void context.channel
    ?.exchange('RESTORE_MEASUREMENTS', { studyInstanceUid: studyInstanceUid(), measurements })
    .then((answer) => {
      dispatchRestoreFailures(context, answer);
    })
    .catch(warnUnanswered);
};

export const createViewerEventHandlers = ({
  getContext,
  restoredRows,
}: ViewerEventHandlersDeps): ((event: ViewerEvent) => void) => {
  let readyCount = 0;

  // The first READY is where a reloaded form asks for its annotations back (A-14); an early
  // activation is still queued in the channel and flushes itself (A-9). A later READY means the
  // viewer reloaded and forgot the tool it was armed with, so the drawing row is armed again.
  const handleViewerReady = (): void => {
    readyCount += 1;
    const context = getContext();
    if (readyCount === 1) {
      requestRestore(context, restoredRows);
      return;
    }
    const drawingRow = findDrawingRow(context.state.rows);
    if (drawingRow !== undefined) {
      context.channel?.send(activateTool(drawingRow.rowId, drawingRow.toolName));
    }
  };

  // Nothing for MEASUREMENTS_RESTORED: the exchange above consumes the answer to our own request,
  // and no other reply concerns this session (A-21).
  return (event: ViewerEvent): void => {
    switch (event.type) {
      case 'VIEWER_READY':
        handleViewerReady();
        break;
      case 'MEASUREMENT_ADDED':
        dispatchMeasurementAdded(getContext(), event);
        break;
      case 'MEASUREMENT_UPDATED':
        dispatchMeasurementUpdated(getContext(), event);
        break;
      case 'MEASUREMENT_REMOVED':
        dispatchMeasurementCleared(getContext(), event);
        break;
      case 'MEASUREMENTS_RESTORED':
        break;
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  };
};
