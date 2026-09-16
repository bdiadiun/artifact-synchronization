// Pure form-row state (canon C-4.3.1, C-4.3.2, C-4.3.7, Q-3, decision A-4). No side effects, no
// bridge calls here: `useScoringForm.ts` wires this reducer to `send`/`lastEvent`. Kept
// side-effect-free so the row lifecycle rules can be unit-tested without React or a fake iframe.

import type { Metrics, ToolName } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';

// A-13: string enum for row lifecycle status (application state, not wire contract data).
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

// A-13: string enum for reducer action types (application state, not wire contract data). Values
// match the previous string literals so nothing downstream (tests, serialised state) changes.
export enum FormActionType {
  AddRow = 'ADD_ROW',
  ArmRow = 'ARM_ROW',
  DisarmRow = 'DISARM_ROW',
  // Wired to the bridge in a later slice (viewer -> host measurement flow); the reducer rule is
  // implemented now so it does not have to change when that wiring lands.
  MeasurementReceived = 'MEASUREMENT_RECEIVED',
  // S-5.1 live update: matched by `measurementUid` (not `rowId` - the viewer does not know it),
  // and only applied to a `done` row, since that is the only status a measurementUid is bound to.
  MeasurementUpdated = 'MEASUREMENT_UPDATED',
  // S-5.2 deletion, host -> viewer direction: the row is dropped outright, regardless of its
  // current status (done/drawing/pending all delete the same way once the caller has already
  // sent whatever command the status required - see useScoringForm.remove).
  RemoveRow = 'REMOVE_ROW',
  // S-5.2 deletion, viewer -> host direction: the annotation was removed in the viewer and the
  // event was not our own echo (A-10). The assignment says deletion in the viewer "clears the
  // row", not removes it, so a `done` row returns to `pending` instead of disappearing.
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
        // Only one row armed at a time (A-4): any other row currently drawing goes back to
        // pending, whether or not it was `armedRowId` (defensive, keeps invariant even if state
        // ever drifted).
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
