// What the form does to the viewer: what each button does to its row (a change of state and the
// command that goes with it), and what a viewer that has just announced itself is given back.

import type { Dispatch } from 'react';
import type { ToolName } from '@bdiadiun/scoring-contract';
import { DEFAULT_TOOL } from '@app/config';
import { RowModel, RowStatus, type Row } from '@app/models/row';
import type { FormAction } from './reducer';

export const addRow = (dispatch: Dispatch<FormAction>, toolName: ToolName = DEFAULT_TOOL): void => {
  dispatch({ type: 'ADD_ROW', row: RowModel.create(toolName) });
};

// A-4: one row is armed at a time, and ACTIVATE_TOOL replaces the armed row on both sides, so no
// deactivation of the previous one is sent.
export const activateRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  dispatch({ type: 'ACTIVATE_TOOL', rowId: row.rowId, toolName: row.toolName });
};

export const cancelRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  dispatch({ type: 'DEACTIVATE_TOOL', rowId: row.rowId });
};

// A drawing row is cancelled in the viewer first; a done row has its annotation removed there.
// The viewer's MEASUREMENT_REMOVED then comes back for a row that is already gone, and the
// reducer ignores a uid no row holds (A-30).
export const removeRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  if (row.status === RowStatus.Drawing) {
    dispatch({ type: 'DEACTIVATE_TOOL', rowId: row.rowId });
  }
  if (row.measurementUid !== null) {
    dispatch({ type: 'REMOVE_MEASUREMENT', measurementUid: row.measurementUid });
  }
  dispatch({ type: 'REMOVE_ROW', rowId: row.rowId });
};

// Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
export const focusRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  if (row.status === RowStatus.Done && row.measurementUid !== null) {
    dispatch({ type: 'FOCUS_MEASUREMENT', measurementUid: row.measurementUid });
  }
};

// Every VIEWER_READY is a viewer that has none of our annotations yet, so the rows it can rebuild
// are offered again (A-14, S-5.6) and the row that was drawing is armed again: at most one row is
// `drawing` at a time (A-4), so the armed row is read off the rows rather than mirrored anywhere.
export const restoreViewer = (dispatch: Dispatch<FormAction>, studyInstanceUid: string, rows: readonly Row[]): void => {
  const measurements = rows.map(RowModel.toRestoreRequest).filter((request) => request !== null);
  if (measurements.length > 0) {
    dispatch({
      type: 'RESTORE_MEASUREMENTS',
      studyInstanceUid,
      measurements,
    });
  }
  const drawingRow = rows.find((row) => row.status === RowStatus.Drawing);
  if (drawingRow !== undefined) {
    dispatch({ type: 'ACTIVATE_TOOL', rowId: drawingRow.rowId, toolName: drawingRow.toolName });
  }
};
