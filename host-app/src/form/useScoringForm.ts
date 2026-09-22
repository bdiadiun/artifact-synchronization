import { useEffect, useReducer, useRef } from 'react';
import type { HostChannel } from '@app/channel/useHostChannel';
import { reducer, type FormContext, type FormState, type Row } from './rows';
import { createRowActions, type RowActions } from './rowActions';
import { usePersistRows, useRestoredRows } from './storage';
import { createViewerEventHandlers } from './viewerEventHandlers';

export interface UseScoringFormResult extends RowActions {
  rows: Row[];
}

// A-14: reducer stays pure, so restore reads sessionStorage once here, before the first render,
// and seeds the reducer's initial state instead of dispatching an action.
const buildInitialState = (rows: Row[]): FormState => ({ rows });

export const useScoringForm = (channel: HostChannel | null): UseScoringFormResult => {
  const restoredRows = useRestoredRows();
  const [state, dispatch] = useReducer(reducer, restoredRows, buildInitialState);
  usePersistRows(state.rows);

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
