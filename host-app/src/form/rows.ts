// Pure, side-effect-free reducer; `useScoringForm.ts` wires it to the channel's events.

import { findRow, findRowByUid } from '@app/utils/selectors';
import type { ActionOf, FormAction, FormState, Row } from './rows.props';

export type { FormAction, FormState, Row } from './rows.props';

export enum RowStatus {
  Pending = 'pending',
  Drawing = 'drawing',
  Done = 'done',
}

export enum FormActionType {
  AddRow = 'ADD_ROW',
  ArmRow = 'ARM_ROW',
  DisarmRow = 'DISARM_ROW',
  MeasurementReceived = 'MEASUREMENT_RECEIVED',
  MeasurementUpdated = 'MEASUREMENT_UPDATED',
  RemoveRow = 'REMOVE_ROW',
  // Viewer-side deletion "clears" a `done` row back to `pending` rather than removing it, per the
  // assignment's wording.
  MeasurementCleared = 'MEASUREMENT_CLEARED',
  // A-14: a row named in a MEASUREMENTS_RESTORED reply's `failed` list.
  RestoreFailed = 'RESTORE_FAILED',
}

export const initialFormState: FormState = { rows: [] };

// A-4: one row is armed at a time, and it is the one the viewer is drawing into.
export const findDrawingRow = (rows: readonly Row[]): Row | undefined =>
  rows.find((row) => row.status === RowStatus.Drawing);

const replaceRow = (state: FormState, rowId: string, patch: Partial<Row>): Row[] =>
  state.rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row));

const addRow = (state: FormState, action: ActionOf<FormActionType.AddRow>): FormState => {
  const newRow: Row = {
    rowId: action.rowId,
    status: RowStatus.Pending,
    toolName: action.toolName,
    metrics: null,
    measurementUid: null,
    geometry: null,
    restoreFailureReason: null,
  };
  return { rows: [...state.rows, newRow] };
};

const armRow = (state: FormState, action: ActionOf<FormActionType.ArmRow>): FormState => {
  const target = findRow(state.rows, action.rowId);
  // Already drawing means nothing changes: A-4 keeps every other row out of that status.
  if (target === undefined || target.status === RowStatus.Drawing) {
    return state;
  }
  const rows = state.rows.map((row) => {
    if (row.rowId === action.rowId) {
      return { ...row, status: RowStatus.Drawing };
    }
    // Only one row armed at a time (A-4): any other drawing row goes back to pending.
    return row.status === RowStatus.Drawing ? { ...row, status: RowStatus.Pending } : row;
  });
  return { rows };
};

const disarmRow = (state: FormState, action: ActionOf<FormActionType.DisarmRow>): FormState => {
  const target = findRow(state.rows, action.rowId);
  if (target?.status !== RowStatus.Drawing) {
    return state;
  }
  return { rows: replaceRow(state, action.rowId, { status: RowStatus.Pending }) };
};

const receiveMeasurement = (
  state: FormState,
  action: ActionOf<FormActionType.MeasurementReceived>,
): FormState => {
  const target = findRow(state.rows, action.rowId);
  if (target?.status !== RowStatus.Drawing) {
    return state;
  }
  return {
    rows: replaceRow(state, action.rowId, {
      status: RowStatus.Done,
      metrics: action.metrics,
      measurementUid: action.measurementUid,
      geometry: action.geometry,
    }),
  };
};

const updateMeasurement = (
  state: FormState,
  action: ActionOf<FormActionType.MeasurementUpdated>,
): FormState => {
  const target = findRowByUid(state.rows, action.measurementUid);
  if (target?.status !== RowStatus.Done) {
    return state;
  }
  const rows = state.rows.map((row) =>
    row.measurementUid === action.measurementUid ? { ...row, metrics: action.metrics } : row,
  );
  return { rows };
};

const removeRow = (state: FormState, action: ActionOf<FormActionType.RemoveRow>): FormState => {
  if (findRow(state.rows, action.rowId) === undefined) {
    return state;
  }
  return { rows: state.rows.filter((row) => row.rowId !== action.rowId) };
};

// A-8: the viewer owns measurement ids, so a deletion that happened there names the uid and the
// row it belongs to is looked up here.
const clearMeasurement = (
  state: FormState,
  action: ActionOf<FormActionType.MeasurementCleared>,
): FormState => {
  const target = findRowByUid(state.rows, action.measurementUid);
  if (target?.status !== RowStatus.Done) {
    return state;
  }
  return {
    rows: replaceRow(state, target.rowId, {
      status: RowStatus.Pending,
      metrics: null,
      measurementUid: null,
    }),
  };
};

const markRestoreFailed = (
  state: FormState,
  action: ActionOf<FormActionType.RestoreFailed>,
): FormState => {
  const target = findRow(state.rows, action.rowId);
  if (target === undefined || target.restoreFailureReason === action.reason) {
    return state;
  }
  return { rows: replaceRow(state, action.rowId, { restoreFailureReason: action.reason }) };
};

export const reducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case FormActionType.AddRow:
      return addRow(state, action);
    case FormActionType.ArmRow:
      return armRow(state, action);
    case FormActionType.DisarmRow:
      return disarmRow(state, action);
    case FormActionType.MeasurementReceived:
      return receiveMeasurement(state, action);
    case FormActionType.MeasurementUpdated:
      return updateMeasurement(state, action);
    case FormActionType.RemoveRow:
      return removeRow(state, action);
    case FormActionType.MeasurementCleared:
      return clearMeasurement(state, action);
    case FormActionType.RestoreFailed:
      return markRestoreFailed(state, action);
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
};
