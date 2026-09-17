// Pure, side-effect-free reducer; `useScoringForm.ts` wires it to `send`/`lastEvent`.

import type { Metrics, ToolName } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';

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
  | { type: FormActionType.AddRow; rowId: string }
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

export const initialFormState: FormState = { rows: [], armedRowId: null };

export const reducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case FormActionType.AddRow: {
      const newRow: Row = {
        rowId: action.rowId,
        status: RowStatus.Pending,
        toolName: DEFAULT_TOOL,
        metrics: null,
        measurementUid: null,
      };
      return { ...state, rows: [...state.rows, newRow] };
    }

    case FormActionType.ArmRow: {
      const targetExists = state.rows.some((row) => row.rowId === action.rowId);
      if (!targetExists) {
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
    }

    case FormActionType.DisarmRow: {
      const target = state.rows.find((row) => row.rowId === action.rowId);
      if (target?.status !== RowStatus.Drawing) {
        return state;
      }
      const rows = state.rows.map((row) =>
        row.rowId === action.rowId ? { ...row, status: RowStatus.Pending } : row,
      );
      const armedRowId = state.armedRowId === action.rowId ? null : state.armedRowId;
      return { rows, armedRowId };
    }

    case FormActionType.MeasurementReceived: {
      const target = state.rows.find((row) => row.rowId === action.rowId);
      if (target?.status !== RowStatus.Drawing) {
        return state;
      }
      const rows = state.rows.map((row) =>
        row.rowId === action.rowId
          ? {
              ...row,
              status: RowStatus.Done,
              metrics: action.metrics,
              measurementUid: action.measurementUid,
            }
          : row,
      );
      const armedRowId = state.armedRowId === action.rowId ? null : state.armedRowId;
      return { rows, armedRowId };
    }

    case FormActionType.MeasurementUpdated: {
      const target = state.rows.find((row) => row.measurementUid === action.measurementUid);
      if (target?.status !== RowStatus.Done) {
        return state;
      }
      const rows = state.rows.map((row) =>
        row.measurementUid === action.measurementUid ? { ...row, metrics: action.metrics } : row,
      );
      return { ...state, rows };
    }

    case FormActionType.RemoveRow: {
      const targetExists = state.rows.some((row) => row.rowId === action.rowId);
      if (!targetExists) {
        return state;
      }
      const rows = state.rows.filter((row) => row.rowId !== action.rowId);
      const armedRowId = state.armedRowId === action.rowId ? null : state.armedRowId;
      return { rows, armedRowId };
    }

    case FormActionType.MeasurementCleared: {
      const target = state.rows.find((row) => row.rowId === action.rowId);
      if (target?.status !== RowStatus.Done) {
        return state;
      }
      const rows = state.rows.map((row) =>
        row.rowId === action.rowId
          ? { ...row, status: RowStatus.Pending, metrics: null, measurementUid: null }
          : row,
      );
      return { ...state, rows };
    }

    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
};
