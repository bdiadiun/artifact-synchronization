import { useEffect } from 'react';
import { STUDY_INSTANCE_UID } from '../config';
import type { Row } from '../form/rows';
import { saveRows } from '../form/storage';

// A-14: the form owns the saved state, so every row change is written back, including the ones no
// user action caused (the reducer applying a restore-failure marker).
export const usePersistRows = (rows: readonly Row[]): void => {
  useEffect(() => {
    saveRows(STUDY_INSTANCE_UID, rows);
  }, [rows]);
};
