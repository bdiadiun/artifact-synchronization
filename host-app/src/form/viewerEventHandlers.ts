// What each viewer event does to the form: it only changes state, it never sends a command in
// reaction (A-30), which is the whole echo-loop guard. Which rows change is the reducer's decision;
// it ignores an event for a row that is not drawing or a uid no row holds.

import type { RestoreMeasurementRequest, ViewerEvent } from '@bdiadiun/scoring-contract';
import { studyInstanceUid } from '@app/config';
import { findDrawingRow, FormActionType, type FormContext, type Row } from './rows';

// Only a row with both a stored uid and its geometry can be re-added in the viewer (A-14).
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

// Every READY is a viewer that has none of our annotations yet: the rows it can rebuild are
// offered again (A-14), and the row that was drawing is armed again (the viewer forgot its tool).
const handleViewerReady = ({ state, channel }: FormContext): void => {
  const measurements = restorableMeasurements(state.rows);
  if (measurements.length > 0) {
    channel?.send({
      type: 'RESTORE_MEASUREMENTS',
      studyInstanceUid: studyInstanceUid(),
      measurements,
    });
  }
  const drawingRow = findDrawingRow(state.rows);
  if (drawingRow !== undefined) {
    channel?.send({
      type: 'ACTIVATE_TOOL',
      rowId: drawingRow.rowId,
      toolName: drawingRow.toolName,
    });
  }
};

export const createViewerEventHandlers = (
  getContext: () => FormContext,
): ((event: ViewerEvent) => void) => {
  const handleViewerEvent = (event: ViewerEvent): void => {
    const context = getContext();
    const { dispatch } = context;

    switch (event.type) {
      case 'VIEWER_READY':
        handleViewerReady(context);
        break;
      case 'MEASUREMENT_ADDED':
        // A-8: a measurement drawn while nothing was armed arrives with `rowId: null` and is dropped.
        if (event.rowId === null) {
          console.info('[form] measurement without an armed row ignored', event.measurementUid);
          break;
        }
        dispatch({
          type: FormActionType.MeasurementReceived,
          rowId: event.rowId,
          measurementUid: event.measurementUid,
          metrics: event.metrics,
          geometry: event.geometry ?? null,
        });
        break;
      case 'MEASUREMENT_UPDATED':
        dispatch({
          type: FormActionType.MeasurementUpdated,
          measurementUid: event.measurementUid,
          metrics: event.metrics,
        });
        break;
      case 'MEASUREMENT_REMOVED':
        dispatch({ type: FormActionType.MeasurementCleared, measurementUid: event.measurementUid });
        break;
      case 'MEASUREMENTS_RESTORED':
        for (const failure of event.failed) {
          dispatch({
            type: FormActionType.RestoreFailed,
            rowId: failure.rowId,
            reason: failure.reason,
          });
        }
        break;
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  };

  return handleViewerEvent;
};
