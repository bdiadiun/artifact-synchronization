import { useEffect, useMemo, useReducer } from 'react';
import type { HostChannel } from '@app/channel/useHostChannel';
import { studyInstanceUid } from '@app/config';
import { reducer, type FormContext, type FormState, type Row } from './rows';
import { createRowActions, type RowActions } from './rowActions';
import { loadStoredRows, saveRows } from './storage';
import { createViewerEventHandlers } from './viewerEventHandlers';

export interface UseScoringFormResult extends RowActions {
  rows: Row[];
}

// A-14: the rows of this study are read from sessionStorage once, as the reducer's initial state,
// and written back on every change.
const loadInitialState = (): FormState => ({ rows: loadStoredRows(studyInstanceUid()) });

export const useScoringForm = (channel: HostChannel | null): UseScoringFormResult => {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    saveRows(studyInstanceUid(), state.rows);
  }, [state.rows]);

  const context: FormContext = useMemo(
    () => ({ state, dispatch, channel }),
    [state, dispatch, channel],
  );

  // Re-registered whenever the context changes, so a viewer event always reads the current rows;
  // swapping the handler is one assignment in the channel.
  useEffect(() => channel?.onMessage(createViewerEventHandlers(context)), [channel, context]);

  return { rows: state.rows, ...createRowActions(context) };
};
