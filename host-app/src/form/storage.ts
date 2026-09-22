// A-14: rows are persisted in sessionStorage per study, so a reload in the same tab restores them
// and another tab or study never sees them. Every access is defensive: private mode, a full quota
// or a cleared store throw or return nothing, and the form still has to render.

import { z } from 'zod';
import { Row } from './rows';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
export const StoredRow = Row.omit({ restoreFailureReason: true });
export type StoredRow = z.infer<typeof StoredRow>;

export const StoredState = z.object({
  studyInstanceUid: z.string().min(1),
  rows: z.array(StoredRow),
});
export type StoredState = z.infer<typeof StoredState>;

const storageKey = (studyInstanceUid: string): string => `scoring-form:rows:${studyInstanceUid}`;

// Empty on anything but a validated match for this exact study: a missing key, a throw, malformed
// JSON and another study's state all fall back to "nothing to restore" rather than a crash.
export const loadStoredRows = (studyInstanceUid: string): Row[] => {
  try {
    const raw = window.sessionStorage.getItem(storageKey(studyInstanceUid));
    if (raw === null) {
      return [];
    }
    const parsed = StoredState.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.studyInstanceUid !== studyInstanceUid) {
      return [];
    }
    return parsed.data.rows.map((row) => ({ ...row, restoreFailureReason: null }));
  } catch (error) {
    console.warn('[form] failed to read stored form state', error);
    return [];
  }
};

export const saveRows = (studyInstanceUid: string, rows: readonly Row[]): void => {
  try {
    const state: StoredState = {
      studyInstanceUid,
      rows: rows.map(({ restoreFailureReason: _restoreFailureReason, ...row }) => row),
    };
    window.sessionStorage.setItem(storageKey(studyInstanceUid), JSON.stringify(state));
  } catch (error) {
    console.warn('[form] failed to persist form state', error);
  }
};
