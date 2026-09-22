import { useEffect, useMemo } from 'react';
import type { HostChannel } from '@app/channel/useHostChannel';
import type { FormContext, Row } from './rows';
import { createRowActions, type RowActions } from './rowActions';
import { useStoredForm } from './storage';
import { createViewerEventHandlers } from './viewerEventHandlers';

export interface UseScoringFormResult extends RowActions {
  rows: Row[];
}

export const useScoringForm = (channel: HostChannel | null): UseScoringFormResult => {
  const [state, dispatch] = useStoredForm();

  const context: FormContext = useMemo(
    () => ({ state, dispatch, channel }),
    [state, dispatch, channel],
  );

  // Re-registered whenever the context changes, so a viewer event always reads the current rows;
  // swapping the handler is one assignment in the channel.
  useEffect(() => channel?.onMessage(createViewerEventHandlers(context)), [channel, context]);

  return { rows: state.rows, ...createRowActions(context) };
};
