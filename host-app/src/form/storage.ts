// A-14: rows are persisted in sessionStorage per study, so a reload in the same tab restores them
// and another tab or study never sees them. Every access is defensive: private mode, a full quota
// or a cleared store throw or return nothing, and the form still has to render.

import {
  isMeasurementGeometry,
  isMetrics,
  isNonEmptyString,
  isOneOf,
  isRecord,
  isToolName,
  type MeasurementGeometry,
  type Metrics,
} from '@bdiadiun/scoring-contract';
import { RowStatus, type Row } from './rows';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
export type StoredRow = Omit<Row, 'restoreFailureReason'>;

export interface StoredState {
  studyInstanceUid: string;
  rows: StoredRow[];
}

const storageKey = (studyInstanceUid: string): string => `scoring-form:rows:${studyInstanceUid}`;

const ROW_STATUSES: readonly RowStatus[] = Object.values(RowStatus);

const isRowStatus = isOneOf(ROW_STATUSES);

const isStoredMetrics = (value: unknown): value is Metrics | null =>
  value === null || isMetrics(value);

const isStoredGeometry = (value: unknown): value is MeasurementGeometry | null =>
  value === null || isMeasurementGeometry(value);

const isStoredRow = (value: unknown): value is StoredRow =>
  isRecord(value) &&
  isNonEmptyString(value.rowId) &&
  isToolName(value.toolName) &&
  isRowStatus(value.status) &&
  isStoredMetrics(value.metrics) &&
  (value.measurementUid === null || isNonEmptyString(value.measurementUid)) &&
  isStoredGeometry(value.geometry);

const isStoredState = (value: unknown): value is StoredState =>
  isRecord(value) &&
  isNonEmptyString(value.studyInstanceUid) &&
  Array.isArray(value.rows) &&
  value.rows.every(isStoredRow);

// Empty on anything but a validated match for this exact study: a missing key, a throw, malformed
// JSON and another study's state all fall back to "nothing to restore" rather than a crash.
export const loadStoredRows = (studyInstanceUid: string): Row[] => {
  try {
    const raw = window.sessionStorage.getItem(storageKey(studyInstanceUid));
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredState(parsed) || parsed.studyInstanceUid !== studyInstanceUid) {
      return [];
    }
    return parsed.rows.map((row) => ({ ...row, restoreFailureReason: null }));
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
