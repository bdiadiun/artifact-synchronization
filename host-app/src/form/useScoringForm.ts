import { useReducer, useState } from 'react';
import type { HostCommand, ToolName, ViewerEvent } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';
import {
  activateToolCommand,
  deactivateToolCommand,
  focusMeasurementCommand,
  removeMeasurementCommand,
} from './commands';
import { FormActionType, RowStatus, initialFormState, reducer, type Row } from './rows';
import { findRow } from './selectors';
import { useViewerEvents } from './useViewerEvents';
import { createViewerEventHandlers } from './viewerEventHandlers';

export interface UseScoringFormOptions {
  send: (command: HostCommand) => void;
  lastEvent: ViewerEvent | null;
}

export interface UseScoringFormResult {
  rows: Row[];
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
}

export const useScoringForm = ({
  send,
  lastEvent,
}: UseScoringFormOptions): UseScoringFormResult => {
  const [state, dispatch] = useReducer(reducer, initialFormState);
  // requestIds of REMOVE_MEASUREMENT commands issued below; the removal handler drops their echo
  // (A-10). Held through a `useState` initializer rather than a ref: it is a per-mount identity
  // that never affects rendering, and a ref may not be handed to a helper during render.
  const [issuedRemovalRequestIds] = useState<Set<string>>(() => new Set());

  const addRow = (toolName: ToolName = DEFAULT_TOOL): void => {
    dispatch({ type: FormActionType.AddRow, rowId: crypto.randomUUID(), toolName });
  };

  const activate = (rowId: string): void => {
    const previousArmedRowId = state.armedRowId;
    const targetRow = findRow(state.rows, rowId);
    dispatch({ type: FormActionType.ArmRow, rowId });
    // Only one row can be armed at a time (A-4): deactivate the previous one first.
    if (previousArmedRowId !== null && previousArmedRowId !== rowId) {
      send(deactivateToolCommand(crypto.randomUUID(), previousArmedRowId));
    }
    if (targetRow !== undefined) {
      send(activateToolCommand(crypto.randomUUID(), rowId, targetRow.toolName));
    }
  };

  const cancel = (rowId: string): void => {
    dispatch({ type: FormActionType.DisarmRow, rowId });
    send(deactivateToolCommand(crypto.randomUUID(), rowId));
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
      const requestId = crypto.randomUUID();
      // A-10: record the requestId so the REMOVE_MEASUREMENT echo is recognised and ignored.
      issuedRemovalRequestIds.add(requestId);
      dispatch({ type: FormActionType.RemoveRow, rowId });
      send(removeMeasurementCommand(requestId, rowId, row.measurementUid));
      return;
    }
    if (row.status === RowStatus.Drawing) {
      send(deactivateToolCommand(crypto.randomUUID(), rowId));
    }
    dispatch({ type: FormActionType.RemoveRow, rowId });
  };

  // Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
  const focus = (rowId: string): void => {
    const row = findRow(state.rows, rowId);
    if (row?.status !== RowStatus.Done || row.measurementUid === null) {
      return;
    }
    send(focusMeasurementCommand(crypto.randomUUID(), rowId, row.measurementUid));
  };

  const eventHandlers = createViewerEventHandlers({
    state,
    dispatch,
    send,
    issuedRemovalRequestIds,
  });
  useViewerEvents(lastEvent, eventHandlers);

  return { rows: state.rows, addRow, activate, cancel, remove, focus };
};
