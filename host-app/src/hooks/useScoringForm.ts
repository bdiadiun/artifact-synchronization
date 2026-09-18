import { useReducer, useState } from 'react';
import type { HostCommand, ToolName, ViewerEvent } from '@bdiadiun/scoring-contract';
import { reducer, type FormState, type Row } from '../form/rows';
import { createRowActions } from '../form/rowActions';
import { usePersistRows } from './usePersistRows';
import { useRestoredRows } from './useRestoredRows';
import { useViewerEvents } from './useViewerEvents';
import { createViewerEventHandlers } from '../form/viewerEventHandlers';

// A-14: reducer stays pure, so restore reads sessionStorage once here, before the first render,
// and seeds the reducer's initial state instead of dispatching an action.
const buildInitialState = (rows: Row[]): FormState => ({ rows, armedRowId: null });

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
  const restoredRows = useRestoredRows();
  const [state, dispatch] = useReducer(reducer, restoredRows, buildInitialState);
  // requestIds of REMOVE_MEASUREMENT commands issued below; the removal handler drops their echo
  // (A-10). Held through a `useState` initializer rather than a ref: it is a per-mount identity
  // that never affects rendering, and a ref may not be handed to a helper during render.
  const [issuedRemovalRequestIds] = useState<Set<string>>(() => new Set());
  // A-14: same pattern, for the one RESTORE_MEASUREMENTS request a session can issue.
  const [issuedRestoreRequestIds] = useState<Set<string>>(() => new Set());
  usePersistRows(state.rows);

  const rowActions = createRowActions({ state, dispatch, send, issuedRemovalRequestIds });

  const eventHandlers = createViewerEventHandlers({
    state,
    dispatch,
    send,
    issuedRemovalRequestIds,
    restoredRows,
    issuedRestoreRequestIds,
  });
  useViewerEvents(lastEvent, eventHandlers);

  return { rows: state.rows, ...rowActions };
};
