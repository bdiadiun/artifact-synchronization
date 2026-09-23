import { useCallback, useEffect, useReducer, type Dispatch } from 'react';
import { isHostCommand } from '@bdiadiun/scoring-contract';
import { useChannel } from '@bdiadiun/scoring-channel';
import { VIEWER_CHANNEL, type HostChannel } from '@app/config';
import type { Row } from '@app/models/row';
import { reducer, type FormAction } from '@app/state/reducer';
import { loadRows, saveRows } from '@app/services/storedRows';
import { restoreViewer } from '@app/state/actions';

// The form for one study, and the page's end of the channel. Its rows are read from storage once,
// as the reducer's initial state, and written back on every change (A-14); `dispatch` sends every
// action that is a command of the contract and reduces all of them, so nothing else in the form
// talks to the viewer (A-30); and the handler is re-registered whenever the rows change, so a
// viewer that announces itself is offered the rows on screen — a page reload and a viewer reload
// restore the same way (S-5.6).
export const useScoringForm = (studyInstanceUid: string): [Row[], Dispatch<FormAction>, HostChannel] => {
  const channel = useChannel(VIEWER_CHANNEL);
  const [rows, reduce] = useReducer(reducer, studyInstanceUid, loadRows);

  const dispatch = useCallback(
    (action: FormAction): void => {
      if (isHostCommand(action)) {
        channel.send(action);
      }
      reduce(action);
    },
    [channel],
  );

  useEffect(() => {
    saveRows(studyInstanceUid, rows);
  }, [studyInstanceUid, rows]);

  useEffect(
    () =>
      channel.on((event) => {
        if (event.type === 'VIEWER_READY') {
          restoreViewer(dispatch, studyInstanceUid, rows);
        }
        dispatch(event);
      }),
    [channel, dispatch, studyInstanceUid, rows],
  );

  return [rows, dispatch, channel];
};
