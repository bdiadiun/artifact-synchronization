import type { Row } from './rows';

// The fields A-14 asks to persist; `restoreFailureReason` is not among them, so every load starts
// with a clean restore attempt rather than replaying a stale failure.
export type StoredRow = Omit<Row, 'restoreFailureReason'>;

export interface StoredState {
  studyInstanceUid: string;
  rows: StoredRow[];
}
