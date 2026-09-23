// A-14: the rows are persisted in sessionStorage per study (see useScoringForm), so a reload in
// the same tab restores them and another tab or study never sees them. Every access is defensive:
// private mode, a full quota or a cleared store throw or return nothing, and the form still has to
// render.

import { z } from 'zod';
import { Row } from '@app/state/reducer';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
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
const fromStoredState = (value: unknown, studyInstanceUid: string): Row[] => {
  const parsed = StoredState.safeParse(value);
  if (!parsed.success || parsed.data.studyInstanceUid !== studyInstanceUid) {
    return [];
  }
  return parsed.data.rows.map((row) => ({ ...row, restoreFailureReason: null }));
};

export const getStorage = (studyInstanceUid: string): Row[] => {
  try {
    const raw = window.sessionStorage.getItem(storageKey(studyInstanceUid));
    return fromStoredState(raw === null ? undefined : JSON.parse(raw), studyInstanceUid);
  } catch (error) {
    console.warn('[form] failed to read stored form state', error);
    return [];
  }
};

export const setStorage = (studyInstanceUid: string, rows: readonly Row[]): void => {
  try {
    const value = JSON.stringify(toStoredState(studyInstanceUid, rows));
    window.sessionStorage.setItem(storageKey(studyInstanceUid), value);
  } catch (error) {
    console.warn('[form] failed to persist form state', error);
  }
};
