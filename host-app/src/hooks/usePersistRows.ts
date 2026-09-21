import { useEffect } from 'react';
import { studyInstanceUid } from '@app/config';
import type { Row } from '@app/form/rows';
import { saveRows } from '@app/form/storage';

// A-14: the form owns the saved state, so every row change is written back, including the ones no
// user action caused (the reducer applying a restore-failure marker).
export const usePersistRows = (rows: readonly Row[]): void => {
  useEffect(() => {
    saveRows(studyInstanceUid(), rows);
  }, [rows]);
};
