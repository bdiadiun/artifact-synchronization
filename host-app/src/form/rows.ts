// Pure form-row state (canon C-4.3.1, C-4.3.2, C-4.3.7, Q-3, decision A-4). No side effects, no
// bridge calls here: `useScoringForm.ts` wires this reducer to `send`/`lastEvent`. Kept
// side-effect-free so the row lifecycle rules can be unit-tested without React or a fake iframe.

import type { Metrics, ToolName } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';

export type RowStatus = 'pending' | 'drawing' | 'done';

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

export type FormAction =
  | { type: 'ADD_ROW'; rowId: string }
  | { type: 'ARM_ROW'; rowId: string }
  | { type: 'DISARM_ROW'; rowId: string }
  // Wired to the bridge in a later slice (viewer -> host measurement flow); the reducer rule is
  // implemented now so it does not have to change when that wiring lands.
  | { type: 'MEASUREMENT_RECEIVED'; rowId: string; measurementUid: string; metrics: Metrics }
  // S-5.1 live update: matched by `measurementUid` (not `rowId` - the viewer does not know it),
  // and only applied to a `done` row, since that is the only status a measurementUid is bound to.
  | { type: 'MEASUREMENT_UPDATED'; measurementUid: string; metrics: Metrics };

export const initialFormState: FormState = { rows: [], armedRowId: null };

export function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'ADD_ROW': {
      const newRow: Row = {
        rowId: action.rowId,
        status: 'pending',
        toolName: DEFAULT_TOOL,
        metrics: null,
        measurementUid: null,
      };
      return { ...state, rows: [...state.rows, newRow] };
    }

    case 'ARM_ROW': {
      const targetExists = state.rows.some((row) => row.rowId === action.rowId);
      if (!targetExists) {
        return state;
      }
      const rows = state.rows.map((row) => {
        if (row.rowId === action.rowId) {
          return row.status === 'drawing' ? row : { ...row, status: 'drawing' as const };
        }
        // Only one row armed at a time (A-4): any other row currently drawing goes back to
        // pending, whether or not it was `armedRowId` (defensive, keeps invariant even if state
        // ever drifted).
        return row.status === 'drawing' ? { ...row, status: 'pending' as const } : row;
      });
      return { rows, armedRowId: action.rowId };
    }

    case 'DISARM_ROW': {
      const target = state.rows.find((row) => row.rowId === action.rowId);
      if (!target || target.status !== 'drawing') {
        return state;
      }
      const rows = state.rows.map((row) =>
        row.rowId === action.rowId ? { ...row, status: 'pending' as const } : row,
      );
      const armedRowId = state.armedRowId === action.rowId ? null : state.armedRowId;
      return { rows, armedRowId };
    }

    case 'MEASUREMENT_RECEIVED': {
      const target = state.rows.find((row) => row.rowId === action.rowId);
      if (!target || target.status !== 'drawing') {
        return state;
      }
      const rows = state.rows.map((row) =>
        row.rowId === action.rowId
          ? {
              ...row,
              status: 'done' as const,
              metrics: action.metrics,
              measurementUid: action.measurementUid,
            }
          : row,
      );
      const armedRowId = state.armedRowId === action.rowId ? null : state.armedRowId;
      return { rows, armedRowId };
    }

    case 'MEASUREMENT_UPDATED': {
      const target = state.rows.find((row) => row.measurementUid === action.measurementUid);
      if (!target || target.status !== 'done') {
        return state;
      }
      const rows = state.rows.map((row) =>
        row.measurementUid === action.measurementUid ? { ...row, metrics: action.metrics } : row,
      );
      return { ...state, rows };
    }

    default:
      return state;
  }
}
