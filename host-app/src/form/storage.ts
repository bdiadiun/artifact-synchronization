// A-14: rows are persisted in sessionStorage per study, so a reload in the same tab restores them
// and another tab or study never sees them. Every access is defensive: private mode, a full quota
// or a cleared store throw or return nothing, and the form still has to render.

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { MeasurementGeometry, Metrics, ToolName } from '@bdiadiun/scoring-contract';
import { studyInstanceUid } from '@app/config';
import { RowStatus, type Row } from './rows';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
export type StoredRow = Omit<Row, 'restoreFailureReason'>;

export interface StoredState {
  studyInstanceUid: string;
  rows: StoredRow[];
}

const storageKey = (studyInstanceUid: string): string => `scoring-form:rows:${studyInstanceUid}`;

const StoredRowSchema = z.object({
  rowId: z.string().min(1),
  status: z.enum(RowStatus),
  toolName: ToolName,
  metrics: Metrics.nullable(),
  measurementUid: z.string().min(1).nullable(),
  geometry: MeasurementGeometry.nullable(),
});

const StoredStateSchema = z.object({
  studyInstanceUid: z.string().min(1),
  rows: z.array(StoredRowSchema),
});

// Empty on anything but a validated match for this exact study: a missing key, a throw, malformed
// JSON and another study's state all fall back to "nothing to restore" rather than a crash.
export const loadStoredRows = (studyInstanceUid: string): Row[] => {
  try {
    const raw = window.sessionStorage.getItem(storageKey(studyInstanceUid));
    if (raw === null) {
      return [];
    }
    const parsed = StoredStateSchema.safeParse(JSON.parse(raw));
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

// Resolves before `useScoringForm` creates its reducer, because it seeds the initial state.
// Read once per mount: sessionStorage is per-tab (A-14), so a later change to it (another tab,
// another study) must not resurrect rows into an already-running session.
export const useRestoredRows = (): Row[] =>
  useState<Row[]>(() => loadStoredRows(studyInstanceUid()))[0];

// A-14: the form owns the saved state, so every row change is written back, including the ones no
// user action caused (the reducer applying a restore-failure marker).
export const usePersistRows = (rows: readonly Row[]): void => {
  useEffect(() => {
    saveRows(studyInstanceUid(), rows);
  }, [rows]);
};
