// A-14: the rows are persisted per study, so a reload in the same tab restores them and another
// tab or study never sees them. The fields A-14 asks to persist; `restoreFailureReason` is not
// among them, so every load starts with a clean restore attempt rather than replaying a stale
// failure.

import { z } from 'zod';
import { readStorage, writeStorage } from '@app/services/storage';
import { Row } from './reducer';

const StoredRow = Row.omit({ restoreFailureReason: true });
type StoredRow = z.infer<typeof StoredRow>;

const StoredState = z.object({
  studyInstanceUid: z.string().min(1),
  rows: z.array(StoredRow),
});
type StoredState = z.infer<typeof StoredState>;

const storageKey = (studyInstanceUid: string): string => `scoring-form:rows:${studyInstanceUid}`;

const toStoredState = (studyInstanceUid: string, rows: readonly Row[]): StoredState => ({
  studyInstanceUid,
  rows: rows.map(({ restoreFailureReason: _restoreFailureReason, ...row }) => row),
});

// Rows only from a validated state under this exact study; anything else is "nothing to restore".
export const loadRows = (studyInstanceUid: string): Row[] => {
  const stored = readStorage(storageKey(studyInstanceUid), StoredState);
  if (stored?.studyInstanceUid !== studyInstanceUid) {
    return [];
  }
  return stored.rows.map((row) => ({ ...row, restoreFailureReason: null }));
};

export const saveRows = (studyInstanceUid: string, rows: readonly Row[]): void => {
  writeStorage(storageKey(studyInstanceUid), toStoredState(studyInstanceUid, rows));
};
