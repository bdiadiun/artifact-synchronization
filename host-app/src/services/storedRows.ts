// A-14: the rows are persisted per study, so a reload in the same tab restores them and another
// tab or study never sees them.

import { z } from 'zod';
import { RowModel, type Row } from '@app/models/row';
import { readStorage, writeStorage } from './storage';

const StoredRows = z.object({
  studyInstanceUid: z.string().min(1),
  rows: z.array(RowModel.jsonSchema),
});
type StoredRows = z.infer<typeof StoredRows>;

const storageKey = (studyInstanceUid: string): string => `scoring-form:rows:${studyInstanceUid}`;

const toStoredRows = (studyInstanceUid: string, rows: readonly Row[]): StoredRows => ({
  studyInstanceUid,
  rows: rows.map(RowModel.toJSON),
});

// Rows only from a validated state under this exact study; anything else is "nothing to restore".
export const loadRows = (studyInstanceUid: string): Row[] => {
  const stored = readStorage(storageKey(studyInstanceUid), StoredRows);
  if (stored?.studyInstanceUid !== studyInstanceUid) {
    return [];
  }
  return stored.rows.map(RowModel.fromJSON);
};

export const saveRows = (studyInstanceUid: string, rows: readonly Row[]): void => {
  writeStorage(storageKey(studyInstanceUid), toStoredRows(studyInstanceUid, rows));
};
