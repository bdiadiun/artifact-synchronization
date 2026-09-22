// Pure, side-effect-free reducer; `useScoringForm.ts` wires it to the channel's events.

import type { Dispatch } from 'react';
import type {
  MeasurementGeometry,
  Metrics,
  RestoreFailureReason,
  ToolName,
} from '@bdiadiun/scoring-contract';
import type { HostChannel } from '@bdiadiun/scoring-channel';

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

export interface Row {
  rowId: string;
  status: RowStatus;
  toolName: ToolName;
  metrics: Metrics | null;
  measurementUid: string | null;
  // A-14: kept so a restored row can be re-sent to the viewer; null until a measurement arrives.
  geometry: MeasurementGeometry | null;
  // A-14: null unless a RESTORE_MEASUREMENTS reply named this row as failed; the reason drives the
  // marker `MeasurementRow` shows next to a value that has no annotation behind it.
  restoreFailureReason: RestoreFailureReason | null;
}

// At most one row is `drawing` at a time (A-4), so the armed row is the drawing one and is not
// mirrored anywhere: `findDrawingRow` reads it off the rows.
export interface FormState {
  rows: Row[];
}

export type FormAction =
  | { type: FormActionType.AddRow; rowId: string; toolName: ToolName }
  | { type: FormActionType.ArmRow; rowId: string }
  | { type: FormActionType.DisarmRow; rowId: string }
  | {
      type: FormActionType.MeasurementReceived;
      rowId: string;
      measurementUid: string;
      metrics: Metrics;
      geometry: MeasurementGeometry | null;
    }
  | { type: FormActionType.MeasurementUpdated; measurementUid: string; metrics: Metrics }
  | { type: FormActionType.RemoveRow; rowId: string }
  | { type: FormActionType.MeasurementCleared; measurementUid: string }
  | { type: FormActionType.RestoreFailed; rowId: string; reason: RestoreFailureReason };

type ActionOf<T extends FormActionType> = Extract<FormAction, { type: T }>;

// What a row action and a viewer-event handler are both given: the state they read, the dispatch
// they change it with and the channel they reach the viewer through. The channel is null until the
// mount effect has created it, before which nothing can be clicked.
export interface FormContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  channel: HostChannel | null;
}

export const initialFormState: FormState = { rows: [] };

export const findRow = (rows: readonly Row[], rowId: string): Row | undefined =>
  rows.find((row) => row.rowId === rowId);

// A-8: the viewer owns measurement ids, so an incoming event is matched by uid, not by row id.
export const findRowByUid = (rows: readonly Row[], measurementUid: string): Row | undefined =>
  rows.find((row) => row.measurementUid === measurementUid);

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
