// What each user-triggered row action does to state, dispatch and the channel. Mirrors
// viewerEventHandlers.ts, which does the same job for the incoming half of the form.

import type { ToolName } from '@bdiadiun/scoring-contract';
import { DEFAULT_TOOL } from '@app/config';
import { findRow, FormActionType, RowStatus, type FormContext } from './rows';

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

  // A-4: one row is armed at a time, and ACTIVATE_TOOL replaces the armed row on both sides, so no
  // deactivation of the previous one is sent.
  const activate = (rowId: string): void => {
    const targetRow = findRow(state.rows, rowId);
    dispatch({ type: FormActionType.ArmRow, rowId });
    if (targetRow !== undefined) {
      channel?.send({ type: 'ACTIVATE_TOOL', rowId, toolName: targetRow.toolName });
    }
  };

  const cancel = (rowId: string): void => {
    dispatch({ type: FormActionType.DisarmRow, rowId });
    channel?.send({ type: 'DEACTIVATE_TOOL', rowId });
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
      // The viewer's MEASUREMENT_REMOVED comes back for a row that is already gone, and the
      // reducer ignores a uid no row holds (A-10).
      channel?.send({ type: 'REMOVE_MEASUREMENT', measurementUid: row.measurementUid });
      return;
    }
    if (row.status === RowStatus.Drawing) {
      channel?.send({ type: 'DEACTIVATE_TOOL', rowId });
    }
    dispatch({ type: FormActionType.RemoveRow, rowId });
  };

  // Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
  const focus = (rowId: string): void => {
    const row = findRow(state.rows, rowId);
    if (row?.status !== RowStatus.Done || row.measurementUid === null) {
      return;
    }
    channel?.send({ type: 'FOCUS_MEASUREMENT', measurementUid: row.measurementUid });
  };

  return { addRow, activate, cancel, remove, focus };
};
