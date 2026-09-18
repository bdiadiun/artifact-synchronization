import { useState } from 'react';
import { STUDY_INSTANCE_UID } from '../config';
import type { Row } from '../form/rows';
import { loadStoredRows } from '../form/storage';

// Resolves before `useScoringForm` creates its reducer, because it seeds the initial state.
// Read once per mount: sessionStorage is per-tab (A-14), so a later change to it (another tab,
// another study) must not resurrect rows into an already-running session.
export const useRestoredRows = (): Row[] =>
  useState<Row[]>(() => loadStoredRows(STUDY_INSTANCE_UID))[0];
