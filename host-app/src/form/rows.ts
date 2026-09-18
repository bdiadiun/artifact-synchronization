// Pure, side-effect-free reducer; `useScoringForm.ts` wires it to `send`/`lastEvent`.

import type { Metrics, ToolName } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';
import { findRow, findRowByUid, hasRow } from './selectors';

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
}

export interface FormState {
  rows: Row[];
  // At most one row is `drawing` at a time (A-4); this mirrors that row's id, or null.
  armedRowId: string | null;
}

// S-5.4: the metric a row's tool produces. Derived from `toolName` rather than stored as its own
// field, so the two can never drift apart.
export type MetricKey = 'area' | 'length';

const METRIC_KEY_BY_TOOL: Record<ToolName, MetricKey> = {
  EllipticalROI: 'area',
  RectangleROI: 'area',
  Length: 'length',
};

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
    }
  | { type: FormActionType.MeasurementUpdated; measurementUid: string; metrics: Metrics }
  | { type: FormActionType.RemoveRow; rowId: string }
  | { type: FormActionType.MeasurementCleared; rowId: string };

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
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
};
