// Persists the form's rows in sessionStorage, scoped to a study (A-14): a reload in the same tab
// restores them, a different tab or a different study never sees another tab's rows. Every read
// and write is defensive — private mode, a full quota or a cleared store all throw or return
// nothing, and the form has to render normally either way.

import type { MeasurementGeometry, Metrics, ToolName } from '@scoring/contract';
import { RowStatus, type Row } from './rows';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
export type StoredRow = Omit<Row, 'restoreFailureReason'>;

interface StoredState {
  studyInstanceUid: string;
  rows: StoredRow[];
}

const storageKey = (studyInstanceUid: string): string => `scoring-form:rows:${studyInstanceUid}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

// The contract package does not export its own tool-name list (it is a private guard helper), so
// this list is kept in step with `ToolName` by hand.
const TOOL_NAMES: readonly ToolName[] = ['EllipticalROI', 'RectangleROI', 'Length'];
const ROW_STATUSES: readonly RowStatus[] = Object.values(RowStatus);

const isToolName = (value: unknown): value is ToolName =>
  typeof value === 'string' && (TOOL_NAMES as readonly string[]).includes(value);

const isRowStatus = (value: unknown): value is RowStatus =>
  typeof value === 'string' && (ROW_STATUSES as readonly string[]).includes(value);

const isStoredMetrics = (value: unknown): value is Metrics | null => {
  if (value === null) {
    return true;
  }
  return (
    isRecord(value) &&
    Object.values(value).every(
      (metric) =>
        isRecord(metric) && typeof metric.value === 'number' && typeof metric.unit === 'string',
    )
  );
};

const isStoredGeometry = (value: unknown): value is MeasurementGeometry | null => {
  if (value === null) {
    return true;
  }
  return (
    isRecord(value) &&
    isNonEmptyString(value.frameOfReferenceUid) &&
    isNonEmptyString(value.referencedImageId) &&
    Array.isArray(value.points) &&
    value.points.every(
      (point) => Array.isArray(point) && point.every((coord) => typeof coord === 'number'),
    ) &&
    (value.label === undefined || typeof value.label === 'string')
  );
};

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
