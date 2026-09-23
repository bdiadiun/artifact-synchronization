import { useEffect, useReducer, type Dispatch } from 'react';
import { reducer, type FormAction, type Row } from '@app/state/reducer';
import { getStorage, setStorage } from '@app/services/storage';
import { restoreViewer } from '@app/state/actions';
import { channel } from '@app/services/channel';
import { useChannel } from './useChannel';

// The form for one study. Its rows are read from storage once, as the reducer's initial state, and
// written back on every change (A-14); every viewer event is an action of the reducer (A-30); and
// every time the viewer announces itself, what is stored for this study is offered back to it — a
// page reload and a viewer reload restore the same way (S-5.6).
export const useScoringForm = (studyInstanceUid: string): [Row[], Dispatch<FormAction>] => {
  const [rows, dispatch] = useReducer(reducer, studyInstanceUid, getStorage);
  const { announcements } = useChannel();

  useEffect(() => {
    setStorage(studyInstanceUid, rows);
  }, [studyInstanceUid, rows]);

  useEffect(() => channel.onMessage(dispatch), [dispatch]);

  useEffect(() => {
    if (announcements > 0) {
      restoreViewer(channel, studyInstanceUid, getStorage(studyInstanceUid));
    }
  }, [announcements, studyInstanceUid]);

  return [rows, dispatch];
};
