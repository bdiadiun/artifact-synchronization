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

  // A drawing row is cancelled in the viewer first; a done row has its annotation removed there.
  // The viewer's MEASUREMENT_REMOVED then comes back for a row that is already gone, and the
  // reducer ignores a uid no row holds (A-30).
  const remove = (rowId: string): void => {
    const row = findRow(state.rows, rowId);
    if (row === undefined) {
      return;
    }
    if (row.status === RowStatus.Drawing) {
      channel?.send({ type: 'DEACTIVATE_TOOL', rowId });
    }
    if (row.measurementUid !== null) {
      channel?.send({ type: 'REMOVE_MEASUREMENT', measurementUid: row.measurementUid });
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
