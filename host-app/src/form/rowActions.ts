// What each user-triggered row action does to state, dispatch and the outgoing bridge. Mirrors
// viewerEventHandlers.ts, which does the same job for the incoming half of the form.

import type { Dispatch } from 'react';
import type { HostCommand, ToolName } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';
import {
  activateToolCommand,
  deactivateToolCommand,
  focusMeasurementCommand,
  removeMeasurementCommand,
} from './commands';
import { FormActionType, RowStatus, type FormAction, type FormState } from './rows';
import { findRow } from '../utils/selectors';

export interface RowActionsContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: (command: HostCommand) => void;
  // requestIds of REMOVE_MEASUREMENT commands issued here; the incoming handler drops their echo
  // (A-10). Owned by the caller so both halves of the form share the same set.
  issuedRemovalRequestIds: Set<string>;
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
    context.send(deactivateToolCommand(crypto.randomUUID(), previousArmedRowId));
  }
  if (targetRow !== undefined) {
    context.send(activateToolCommand(crypto.randomUUID(), rowId, targetRow.toolName));
  }
};

const cancel = (context: RowActionsContext, rowId: string): void => {
  context.dispatch({ type: FormActionType.DisarmRow, rowId });
  context.send(deactivateToolCommand(crypto.randomUUID(), rowId));
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
    const requestId = crypto.randomUUID();
    // A-10: record the requestId so the REMOVE_MEASUREMENT echo is recognised and ignored.
    context.issuedRemovalRequestIds.add(requestId);
    context.dispatch({ type: FormActionType.RemoveRow, rowId });
    context.send(removeMeasurementCommand(requestId, rowId, row.measurementUid));
    return;
  }
  if (row.status === RowStatus.Drawing) {
    context.send(deactivateToolCommand(crypto.randomUUID(), rowId));
  }
  context.dispatch({ type: FormActionType.RemoveRow, rowId });
};

// Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
const focus = (context: RowActionsContext, rowId: string): void => {
  const row = findRow(context.state.rows, rowId);
  if (row?.status !== RowStatus.Done || row.measurementUid === null) {
    return;
  }
  context.send(focusMeasurementCommand(crypto.randomUUID(), rowId, row.measurementUid));
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
