// What each user-triggered row action does to state, dispatch and the outgoing bridge. Mirrors
// viewerEventHandlers.ts, which does the same job for the incoming half of the form.

import type { Dispatch } from 'react';
import type { ToolName } from '@bdiadiun/scoring-contract';
import type { HostChannel } from '@bdiadiun/scoring-orchestrator';
import { DEFAULT_TOOL } from '@app/config';
import { findRow } from '@app/utils/selectors';
import { FormActionType, RowStatus, type FormAction, type FormState } from './rows';
import { warnUnanswered } from './unanswered';

export interface RowActionsContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
}

export interface RowActions {
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
}

const addRow = (context: RowActionsContext, toolName: ToolName = DEFAULT_TOOL): void => {
  context.dispatch({ type: FormActionType.AddRow, rowId: crypto.randomUUID(), toolName });
};

const activate = (context: RowActionsContext, rowId: string): void => {
  const previousArmedRowId = context.state.armedRowId;
  const targetRow = findRow(context.state.rows, rowId);
  context.dispatch({ type: FormActionType.ArmRow, rowId });
  // Only one row can be armed at a time (A-4): deactivate the previous one first.
  if (previousArmedRowId !== null && previousArmedRowId !== rowId) {
    context.send('DEACTIVATE_TOOL', { rowId: previousArmedRowId });
  }
  if (targetRow !== undefined) {
    context.send('ACTIVATE_TOOL', { rowId, toolName: targetRow.toolName });
  }
};

const cancel = (context: RowActionsContext, rowId: string): void => {
  context.dispatch({ type: FormActionType.DisarmRow, rowId });
  context.send('DEACTIVATE_TOOL', { rowId });
};

// Behaviour depends on row status: `done` removes the real annotation in the viewer; `drawing`
// is cancelled first (nothing drawn yet); `pending` just drops the row.
const remove = (context: RowActionsContext, rowId: string): void => {
  const row = findRow(context.state.rows, rowId);
  if (row === undefined) {
    return;
  }
  if (row.status === RowStatus.Done) {
    if (row.measurementUid === null) {
      return;
    }
    context.dispatch({ type: FormActionType.RemoveRow, rowId });
    // A-21: MEASUREMENT_REMOVED answers this request and is consumed by the exchange, so our own
    // echo never reaches the incoming handlers (A-10) and silence is reported instead of ignored.
    void context
      .exchange('REMOVE_MEASUREMENT', { rowId, measurementUid: row.measurementUid })
      .catch(warnUnanswered);
    return;
  }
  if (row.status === RowStatus.Drawing) {
    context.send('DEACTIVATE_TOOL', { rowId });
  }
  context.dispatch({ type: FormActionType.RemoveRow, rowId });
};

// Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
const focus = (context: RowActionsContext, rowId: string): void => {
  const row = findRow(context.state.rows, rowId);
  if (row?.status !== RowStatus.Done || row.measurementUid === null) {
    return;
  }
  context.send('FOCUS_MEASUREMENT', { rowId, measurementUid: row.measurementUid });
};

export const createRowActions = (context: RowActionsContext): RowActions => ({
  addRow: (toolName?: ToolName): void => {
    addRow(context, toolName);
  },
  activate: (rowId: string): void => {
    activate(context, rowId);
  },
  cancel: (rowId: string): void => {
    cancel(context, rowId);
  },
  remove: (rowId: string): void => {
    remove(context, rowId);
  },
  focus: (rowId: string): void => {
    focus(context, rowId);
  },
});
