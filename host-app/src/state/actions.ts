// What the form does to the viewer: what each button does to its row (a change of state and the
// command that goes with it), and what a viewer that has just announced itself is given back.

import type { Dispatch } from 'react';
import type { RestoreMeasurementRequest, ToolName } from '@bdiadiun/scoring-contract';
import { channel, type HostChannel } from '@app/services/channel';
import { DEFAULT_TOOL } from '@app/config';
import { RowStatus, type FormAction, type Row } from './reducer';
import { findDrawingRow } from './selectors';

export const addRow = (dispatch: Dispatch<FormAction>, toolName: ToolName = DEFAULT_TOOL): void => {
  dispatch({ type: 'ADD_ROW', rowId: crypto.randomUUID(), toolName });
};

// A-4: one row is armed at a time, and ACTIVATE_TOOL replaces the armed row on both sides, so no
// deactivation of the previous one is sent.
export const activateRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  dispatch({ type: 'ARM_ROW', rowId: row.rowId });
  channel.send({ type: 'ACTIVATE_TOOL', rowId: row.rowId, toolName: row.toolName });
};

export const cancelRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  dispatch({ type: 'DISARM_ROW', rowId: row.rowId });
  channel.send({ type: 'DEACTIVATE_TOOL', rowId: row.rowId });
};

// A drawing row is cancelled in the viewer first; a done row has its annotation removed there.
// The viewer's MEASUREMENT_REMOVED then comes back for a row that is already gone, and the
// reducer ignores a uid no row holds (A-30).
export const removeRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  if (row.status === RowStatus.Drawing) {
    channel.send({ type: 'DEACTIVATE_TOOL', rowId: row.rowId });
  }
  if (row.measurementUid !== null) {
    channel.send({ type: 'REMOVE_MEASUREMENT', measurementUid: row.measurementUid });
  }
  dispatch({ type: 'REMOVE_ROW', rowId: row.rowId });
};

// Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
export const focusRow = (row: Row): void => {
  if (row.status === RowStatus.Done && row.measurementUid !== null) {
    channel.send({ type: 'FOCUS_MEASUREMENT', measurementUid: row.measurementUid });
  }
};

// Every VIEWER_READY is a viewer that has none of our annotations yet, so the rows it can rebuild
// are offered again (A-14, S-5.6) and the row that was drawing is armed again.
// Only a row with both a stored uid and its geometry can be re-added in the viewer.
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

export const restoreViewer = (
  viewer: HostChannel,
  studyInstanceUid: string,
  rows: readonly Row[],
): void => {
  const measurements = restorableMeasurements(rows);
  if (measurements.length > 0) {
    viewer.send({
      type: 'RESTORE_MEASUREMENTS',
      studyInstanceUid,
      measurements,
    });
  }
  const drawingRow = findDrawingRow(rows);
  if (drawingRow !== undefined) {
    viewer.send({ type: 'ACTIVATE_TOOL', rowId: drawingRow.rowId, toolName: drawingRow.toolName });
  }
};
