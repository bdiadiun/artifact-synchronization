// A-14: the rows are persisted in sessionStorage under one uuid (the study, see useScoringForm),
// so a reload in the same tab restores them and another tab or study never sees them. Every access
// is defensive: private mode, a full quota or a cleared store throw or return nothing, and the form
// still has to render.

import { z } from 'zod';
import { Row } from '@app/state/reducer';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
const StoredRow = Row.omit({ restoreFailureReason: true });
type StoredRow = z.infer<typeof StoredRow>;

const StoredState = z.object({
  uuid: z.string().min(1),
  rows: z.array(StoredRow),
});
type StoredState = z.infer<typeof StoredState>;

const storageKey = (uuid: string): string => `scoring-form:rows:${uuid}`;

const toStoredState = (uuid: string, rows: readonly Row[]): StoredState => ({
  uuid,
  rows: rows.map(({ restoreFailureReason: _restoreFailureReason, ...row }) => row),
});

// Rows only from a validated state under this exact uuid; anything else is "nothing to restore".
const fromStoredState = (value: unknown, uuid: string): Row[] => {
  const parsed = StoredState.safeParse(value);
  if (!parsed.success || parsed.data.uuid !== uuid) {
    return [];
  }
  return parsed.data.rows.map((row) => ({ ...row, restoreFailureReason: null }));
};

export const getStorage = (uuid: string): Row[] => {
  try {
    const raw = window.sessionStorage.getItem(storageKey(uuid));
    return fromStoredState(raw === null ? undefined : JSON.parse(raw), uuid);
  } catch (error) {
    console.warn('[form] failed to read stored form state', error);
    return [];
  }
};

export const setStorage = (uuid: string, rows: readonly Row[]): void => {
  try {
    const value = JSON.stringify(toStoredState(uuid, rows));
    window.sessionStorage.setItem(storageKey(uuid), value);
  } catch (error) {
    console.warn('[form] failed to persist form state', error);
  }
};
