import type { Dispatch } from 'react';
import type { ToolName } from '@bdiadiun/scoring-contract';
import { DEFAULT_TOOL } from '@app/config';
import { RowModel, RowStatus, type Row } from '@app/models/row';
import type { FormAction } from './reducer';

export const addRow = (dispatch: Dispatch<FormAction>, toolName: ToolName = DEFAULT_TOOL): void => {
  dispatch({ type: 'ADD_ROW', row: RowModel.create(toolName) });
};

export const activateRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  dispatch({ type: 'ACTIVATE_TOOL', rowId: row.rowId, toolName: row.toolName });
};

export const cancelRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  dispatch({ type: 'DEACTIVATE_TOOL', rowId: row.rowId });
};

export const removeRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  if (row.status === RowStatus.Drawing) {
    dispatch({ type: 'DEACTIVATE_TOOL', rowId: row.rowId });
  }
  if (row.measurementUid !== null) {
    dispatch({ type: 'REMOVE_MEASUREMENT', measurementUid: row.measurementUid });
  }
  dispatch({ type: 'REMOVE_ROW', rowId: row.rowId });
};

export const focusRow = (dispatch: Dispatch<FormAction>, row: Row): void => {
  if (row.status === RowStatus.Done && row.measurementUid !== null) {
    dispatch({ type: 'FOCUS_MEASUREMENT', measurementUid: row.measurementUid });
  }
};

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
