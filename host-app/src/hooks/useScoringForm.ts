import { useEffect, useReducer, useRef } from 'react';
import type { HostChannel } from '@bdiadiun/scoring-channel';
import { reducer, type FormState, type Row } from '@app/form/rows';
import type { FormContext } from '@app/form/rows.props';
import { createRowActions, type RowActions } from '@app/form/rowActions';
import { createViewerEventHandlers } from '@app/form/viewerEventHandlers';
import { usePersistRows } from './usePersistRows';
import { useRestoredRows } from './useRestoredRows';

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
    return channel.onEach(createViewerEventHandlers({ getContext, restoredRows }));
  }, [channel, restoredRows]);

  return { rows: state.rows, ...createRowActions(context) };
};
