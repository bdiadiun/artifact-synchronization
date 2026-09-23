import { useCallback, useEffect, useReducer, type Dispatch } from 'react';
import { isHostCommand } from '@bdiadiun/scoring-contract';
import { useChannel } from '@bdiadiun/scoring-channel';
import { VIEWER_CHANNEL, type HostChannel } from '@app/config';
import type { Row } from '@app/models/row';
import { reducer, type FormAction } from '@app/state/reducer';
import { restoreViewer } from '@app/state/actions';
import { useStoredRows } from './useStoredRows';

export const useScoringForm = (studyInstanceUid: string): [Row[], Dispatch<FormAction>, HostChannel] => {
  const channel = useChannel(VIEWER_CHANNEL);
  const [storedRows, saveRows] = useStoredRows(studyInstanceUid);
  const [rows, reduce] = useReducer(reducer, storedRows);

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
    saveRows(rows);
  }, [saveRows, rows]);

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
