import { useState } from 'react';
import { studyInstanceUid } from '@app/config';
import type { Row } from '@app/form/rows';
import { loadStoredRows } from '@app/form/storage';

// Resolves before `useScoringForm` creates its reducer, because it seeds the initial state.
// Read once per mount: sessionStorage is per-tab (A-14), so a later change to it (another tab,
// another study) must not resurrect rows into an already-running session.
export const useRestoredRows = (): Row[] =>
  useState<Row[]>(() => loadStoredRows(studyInstanceUid()))[0];
