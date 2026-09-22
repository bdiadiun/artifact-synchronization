// What each user-triggered row action does to state, dispatch and the channel. Mirrors
// viewerEventHandlers.ts, which does the same job for the incoming half of the form.

import type { ToolName } from '@bdiadiun/scoring-contract';
import { DEFAULT_TOOL } from '@app/config';
import { findDrawingRow, findRow, FormActionType, RowStatus, type FormContext } from './rows';

// An exchange rejects when the viewer never answered or the bridge went away mid-request (A-21).
// Neither is recoverable here; both are worth seeing in the console.
export const warnUnanswered = (error: unknown): void => {
  console.warn('[form] a request to the viewer went unanswered', error);
};

export interface RowActions {
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
}

export const createRowActions = ({ state, dispatch, channel }: FormContext): RowActions => {
  const addRow = (toolName: ToolName = DEFAULT_TOOL): void => {
    dispatch({ type: FormActionType.AddRow, rowId: crypto.randomUUID(), toolName });
  };

  const activate = (rowId: string): void => {
    const drawingRow = findDrawingRow(state.rows);
    const targetRow = findRow(state.rows, rowId);
    dispatch({ type: FormActionType.ArmRow, rowId });
    // Only one row can be armed at a time (A-4): deactivate the previous one first.
    if (drawingRow !== undefined && drawingRow.rowId !== rowId) {
      channel?.send('DEACTIVATE_TOOL', { rowId: drawingRow.rowId });
    }
    if (targetRow !== undefined) {
      channel?.send('ACTIVATE_TOOL', { rowId, toolName: targetRow.toolName });
    }
  };

  const cancel = (rowId: string): void => {
    dispatch({ type: FormActionType.DisarmRow, rowId });
    channel?.send('DEACTIVATE_TOOL', { rowId });
  };

  // Behaviour depends on row status: `done` removes the real annotation in the viewer; `drawing`
  // is cancelled first (nothing drawn yet); `pending` just drops the row.
  const remove = (rowId: string): void => {
    const row = findRow(state.rows, rowId);
    if (row === undefined) {
      return;
    }
    if (row.status === RowStatus.Done) {
      if (row.measurementUid === null) {
        return;
      }
      dispatch({ type: FormActionType.RemoveRow, rowId });
      // A-21: MEASUREMENT_REMOVED answers this request and is consumed by the exchange, so our own
      // echo never reaches the incoming handlers (A-10) and silence is reported instead of ignored.
      void channel
        ?.exchange('REMOVE_MEASUREMENT', { rowId, measurementUid: row.measurementUid })
        .catch(warnUnanswered);
      return;
    }
    if (row.status === RowStatus.Drawing) {
      channel?.send('DEACTIVATE_TOOL', { rowId });
    }
    dispatch({ type: FormActionType.RemoveRow, rowId });
  };

  // Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
  const focus = (rowId: string): void => {
    const row = findRow(state.rows, rowId);
    if (row?.status !== RowStatus.Done || row.measurementUid === null) {
      return;
    }
    channel?.send('FOCUS_MEASUREMENT', { rowId, measurementUid: row.measurementUid });
  };

  return { addRow, activate, cancel, remove, focus };
};
