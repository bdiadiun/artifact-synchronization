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

// Only a row with both a stored uid and its geometry can be re-added in the viewer (A-14); a row
// without geometry (older/corrupt storage) is silently left out rather than sent broken.
const restorableMeasurements = (rows: readonly Row[]): RestoreMeasurementRequest[] => {
  const measurements: RestoreMeasurementRequest[] = [];

  for (const row of rows) {
    if (row.measurementUid !== null && row.geometry !== null) {
      measurements.push({
        rowId: row.rowId,
        measurementUid: row.measurementUid,
        toolName: row.toolName,
        geometry: row.geometry,
      });
    }
  }

  return measurements;
};

// A-14: every READY is a viewer that has no annotations of ours yet, so the rows it does not know
// about are offered again; a row it refuses comes back in MEASUREMENTS_RESTORED.
const requestRestore = (context: FormContext): void => {
  const measurements = restorableMeasurements(context.state.rows);
  if (measurements.length === 0) {
    return;
  }
  context.channel?.send({
    type: 'RESTORE_MEASUREMENTS',
    studyInstanceUid: studyInstanceUid(),
    measurements,
  });
};

// A later READY means the viewer reloaded and forgot the tool it was armed with, so the drawing
// row is armed again.
const rearmDrawingRow = (context: FormContext): void => {
  const drawingRow = findDrawingRow(context.state.rows);
  if (drawingRow !== undefined) {
    context.channel?.send({
      type: 'ACTIVATE_TOOL',
      rowId: drawingRow.rowId,
      toolName: drawingRow.toolName,
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

// A removal the form asked for reaches this handler as well; the row is already gone, and the
// reducer ignores a uid no row holds (A-10).
const dispatchMeasurementCleared = (context: FormContext, event: MeasurementRemovedEvent): void => {
  context.dispatch({
    type: FormActionType.MeasurementCleared,
    measurementUid: event.measurementUid,
  });
};

// A-14: a row the viewer refused to restore is marked, so the form can say the value has no
// annotation behind it any more.
const dispatchRestoreFailures = (context: FormContext, event: MeasurementsRestoredEvent): void => {
  for (const failure of event.failed) {
    context.dispatch({
      type: FormActionType.RestoreFailed,
      rowId: failure.rowId,
      reason: failure.reason,
    });
  }
};

export const createViewerEventHandlers = (
  getContext: () => FormContext,
): ((event: ViewerEvent) => void) => {
  const handleViewerReady = (): void => {
    const context = getContext();
    requestRestore(context);
    rearmDrawingRow(context);
  };

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
        dispatchRestoreFailures(getContext(), event);
        break;
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  };
};
