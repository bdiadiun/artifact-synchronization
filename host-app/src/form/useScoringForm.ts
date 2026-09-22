import { useEffect, useReducer, useRef } from 'react';
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

  const context: FormContext = { state, dispatch, channel };

  // The handlers below are registered once per channel, so they read the latest committed context
  // through this ref instead of being taken out and registered again on every render.
  const contextRef = useRef(context);
  useEffect(() => {
    contextRef.current = context;
  });

  useEffect(() => {
    if (channel === null) {
      return undefined;
    }
    const getContext = (): FormContext => contextRef.current;
    const handleViewerEvent = createViewerEventHandlers(getContext);

    return channel.onMessage(handleViewerEvent);
  }, [channel]);

  return { rows: state.rows, ...createRowActions(context) };
};
