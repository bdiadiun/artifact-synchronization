// A-14: the rows are persisted per study, so a reload in the same tab restores them and another
// tab or study never sees them.

import { useEffect, useReducer, type Dispatch } from 'react';
import { z } from 'zod';
import { studyInstanceUid } from '@app/config';
import { reducer, Row, type FormAction, type FormState } from './rows';
import { useSessionStorage } from './useSessionStorage';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
export const StoredRow = Row.omit({ restoreFailureReason: true });
export type StoredRow = z.infer<typeof StoredRow>;

export const StoredState = z.object({
  studyInstanceUid: z.string().min(1),
  rows: z.array(StoredRow),
});
export type StoredState = z.infer<typeof StoredState>;

export const storageKey = (studyInstanceUid: string): string =>
  `scoring-form:rows:${studyInstanceUid}`;

export const toStoredState = (studyInstanceUid: string, rows: readonly Row[]): StoredState => ({
  studyInstanceUid,
  rows: rows.map(({ restoreFailureReason: _restoreFailureReason, ...row }) => row),
});

// Rows only from a validated state of this exact study; anything else is "nothing to restore".
export const fromStoredState = (value: unknown, studyInstanceUid: string): Row[] => {
  const parsed = StoredState.safeParse(value);
  if (!parsed.success || parsed.data.studyInstanceUid !== studyInstanceUid) {
    return [];
  }
  return parsed.data.rows.map((row) => ({ ...row, restoreFailureReason: null }));
};

// The form's state: read from storage once, as the reducer's initial state, and written back on
// every change. The study is resolved once per page load (A-19), so both go to one key.
export const useStoredForm = (): [FormState, Dispatch<FormAction>] => {
  const study = studyInstanceUid();
  const storage = useSessionStorage(storageKey(study));
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    rows: fromStoredState(storage.getStorage(), study),
  }));

  useEffect(() => {
    storage.setStorage(toStoredState(study, state.rows));
  }, [storage, study, state.rows]);

  return [state, dispatch];
};
