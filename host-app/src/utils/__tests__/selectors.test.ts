import { describe, expect, it } from 'vitest';
import { RowStatus, type Row } from '../../form/rows';
import { findRow, findRowByUid, hasRow } from '../selectors';

const row = (rowId: string, measurementUid: string | null): Row => ({
  rowId,
  status: measurementUid === null ? RowStatus.Pending : RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: null,
  measurementUid,
  geometry: null,
  restoreFailureReason: null,
});

const rows: Row[] = [row('row-1', null), row('row-2', 'uid-2')];

describe('findRow', () => {
  it('returns the row with the given id', () => {
    expect(findRow(rows, 'row-2')).toBe(rows[1]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findRow(rows, 'row-9')).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(findRow([], 'row-1')).toBeUndefined();
  });
});

describe('findRowByUid', () => {
  it('returns the row carrying the measurement uid', () => {
    expect(findRowByUid(rows, 'uid-2')).toBe(rows[1]);
  });

  it('never matches a row without a measurement', () => {
    expect(findRowByUid(rows, 'uid-9')).toBeUndefined();
  });
});

describe('hasRow', () => {
  it('is true for a known row id', () => {
    expect(hasRow(rows, 'row-1')).toBe(true);
  });

  it('is false for an unknown row id', () => {
    expect(hasRow(rows, 'row-9')).toBe(false);
  });
});
