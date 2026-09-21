import { useReducer } from 'react';
import type { ToolName, ViewerEvent } from '@bdiadiun/scoring-contract';
import type { HostChannel } from '@bdiadiun/scoring-orchestrator';
import { reducer, type FormState, type Row } from '@app/form/rows';
import { createRowActions } from '@app/form/rowActions';
import { createViewerEventHandlers } from '@app/form/viewerEventHandlers';
import { usePersistRows } from './usePersistRows';
import { useRestoredRows } from './useRestoredRows';
import { useViewerEvents } from './useViewerEvents';

export interface UseScoringFormOptions {
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
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

// A-14: reducer stays pure, so restore reads sessionStorage once here, before the first render,
// and seeds the reducer's initial state instead of dispatching an action.
const buildInitialState = (rows: Row[]): FormState => ({ rows, armedRowId: null });

export const useScoringForm = ({
  send,
  exchange,
  lastEvent,
}: UseScoringFormOptions): UseScoringFormResult => {
  const restoredRows = useRestoredRows();
  const [state, dispatch] = useReducer(reducer, restoredRows, buildInitialState);
  usePersistRows(state.rows);

  const rowActions = createRowActions({ state, dispatch, send, exchange });

  const eventHandlers = createViewerEventHandlers({
    state,
    dispatch,
    send,
    exchange,
    restoredRows,
  });
  useViewerEvents(lastEvent, eventHandlers);

  return { rows: state.rows, ...rowActions };
};
