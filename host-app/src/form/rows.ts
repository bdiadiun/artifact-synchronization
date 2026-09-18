// Pure, side-effect-free reducer; `useScoringForm.ts` wires it to `send`/`lastEvent`.

import {
  METRIC_KEY_BY_TOOL,
  type MeasurementGeometry,
  type MetricKey,
  type Metrics,
  type RestoreFailureReason,
  type ToolName,
} from '@bdiadiun/scoring-contract';
import { DEFAULT_TOOL } from '../config';
import { findRow, findRowByUid, hasRow } from '../utils/selectors';

export enum RowStatus {
  Pending = 'pending',
  Drawing = 'drawing',
  Done = 'done',
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

export interface FormState {
  rows: Row[];
  // At most one row is `drawing` at a time (A-4); this mirrors that row's id, or null.
  armedRowId: string | null;
}

// S-5.4: the metric a row's tool produces; the table itself belongs to the wire contract.
export const metricKeyForTool = (toolName: ToolName): MetricKey => METRIC_KEY_BY_TOOL[toolName];

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

export type FormAction =
  | { type: FormActionType.AddRow; rowId: string; toolName?: ToolName }
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
  | { type: FormActionType.MeasurementCleared; rowId: string }
  | { type: FormActionType.RestoreFailed; rowId: string; reason: RestoreFailureReason };

type ActionOf<T extends FormActionType> = Extract<FormAction, { type: T }>;

export const initialFormState: FormState = { rows: [], armedRowId: null };

const clearArmed = (state: FormState, rowId: string): string | null =>
  state.armedRowId === rowId ? null : state.armedRowId;

const replaceRow = (state: FormState, rowId: string, patch: Partial<Row>): Row[] =>
  state.rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row));

const addRow = (state: FormState, action: ActionOf<FormActionType.AddRow>): FormState => {
  const newRow: Row = {
    rowId: action.rowId,
    status: RowStatus.Pending,
    toolName: action.toolName ?? DEFAULT_TOOL,
    metrics: null,
    measurementUid: null,
    geometry: null,
    restoreFailureReason: null,
  };
  return { ...state, rows: [...state.rows, newRow] };
};

const armRow = (state: FormState, action: ActionOf<FormActionType.ArmRow>): FormState => {
  if (!hasRow(state.rows, action.rowId)) {
    return state;
  }
  const rows = state.rows.map((row) => {
    if (row.rowId === action.rowId) {
      return row.status === RowStatus.Drawing ? row : { ...row, status: RowStatus.Drawing };
    }
    // Only one row armed at a time (A-4): any other drawing row goes back to pending.
    return row.status === RowStatus.Drawing ? { ...row, status: RowStatus.Pending } : row;
  });
  return { rows, armedRowId: action.rowId };
};

const disarmRow = (state: FormState, action: ActionOf<FormActionType.DisarmRow>): FormState => {
  const target = findRow(state.rows, action.rowId);
  if (target?.status !== RowStatus.Drawing) {
    return state;
  }
  return {
    rows: replaceRow(state, action.rowId, { status: RowStatus.Pending }),
    armedRowId: clearArmed(state, action.rowId),
  };
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
    armedRowId: clearArmed(state, action.rowId),
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
  return { ...state, rows };
};

const removeRow = (state: FormState, action: ActionOf<FormActionType.RemoveRow>): FormState => {
  if (!hasRow(state.rows, action.rowId)) {
    return state;
  }
  return {
    rows: state.rows.filter((row) => row.rowId !== action.rowId),
    armedRowId: clearArmed(state, action.rowId),
  };
};

const clearMeasurement = (
  state: FormState,
  action: ActionOf<FormActionType.MeasurementCleared>,
): FormState => {
  const target = findRow(state.rows, action.rowId);
  if (target?.status !== RowStatus.Done) {
    return state;
  }
  return {
    ...state,
    rows: replaceRow(state, action.rowId, {
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
  return {
    ...state,
    rows: replaceRow(state, action.rowId, { restoreFailureReason: action.reason }),
  };
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
