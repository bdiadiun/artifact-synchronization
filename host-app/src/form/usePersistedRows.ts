// sessionStorage sync for the form's rows (A-14). Split in two because of when each runs:
// `useRestoredRows` has to resolve before `useScoringForm` creates its reducer, since it seeds the
// reducer's initial state; `usePersistRows` runs after, once `state.rows` exists.

import { useEffect, useState } from 'react';
import { STUDY_INSTANCE_UID } from '../config';
import type { Row } from './rows';
import { loadStoredRows, saveRows } from './storage';

// Read once per mount: sessionStorage is per-tab (A-14), so a later change to it (another tab,
// another study) must not resurrect rows into an already-running session.
export const useRestoredRows = (): Row[] =>
  useState<Row[]>(() => loadStoredRows(STUDY_INSTANCE_UID))[0];

// The form owns the saved state; every row change (including the reducer applying a
// restore-failure marker) is written back, not just the ones a user action causes.
export const usePersistRows = (rows: readonly Row[]): void => {
  useEffect(() => {
    saveRows(STUDY_INSTANCE_UID, rows);
  }, [rows]);
};
