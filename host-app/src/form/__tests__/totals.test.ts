import { describe, expect, it } from 'vitest';
import type { Metrics } from '@scoring/contract';
import { RowStatus, type Row } from '../rows';
import { computeTotals } from '../totals';

const row = (overrides: Partial<Row> & { rowId: string }): Row => ({
  status: RowStatus.Pending,
  toolName: 'EllipticalROI',
  metrics: null,
  measurementUid: null,
  ...overrides,
});

const doneRow = (rowId: string, metrics: Metrics): Row =>
  row({ rowId, status: RowStatus.Done, metrics, measurementUid: `uid-${rowId}` });

describe('computeTotals', () => {
  it('returns an empty array for no rows', () => {
    expect(computeTotals([])).toEqual([]);
  });

  it('ignores pending and drawing rows', () => {
    const rows: Row[] = [
      row({ rowId: 'a', status: RowStatus.Pending }),
      row({ rowId: 'b', status: RowStatus.Drawing }),
    ];
    expect(computeTotals(rows)).toEqual([]);
  });

  it('sums a single unit', () => {
    const rows: Row[] = [
      doneRow('a', { area: { value: 100, unit: 'mm2' } }),
      doneRow('b', { area: { value: 50, unit: 'mm2' } }),
    ];
    expect(computeTotals(rows)).toEqual([{ unit: 'mm2', value: 150, count: 2 }]);
  });

  it('keeps mm2 and px2 as two separate totals, never merged', () => {
    const rows: Row[] = [
      doneRow('a', { area: { value: 124.5, unit: 'mm2' } }),
      doneRow('b', { area: { value: 1520, unit: 'px2' } }),
    ];
    const totals = computeTotals(rows);
    expect(totals).toHaveLength(2);
    expect(totals.find((t) => t.unit === 'mm2')).toEqual({ unit: 'mm2', value: 124.5, count: 1 });
    expect(totals.find((t) => t.unit === 'px2')).toEqual({ unit: 'px2', value: 1520, count: 1 });
  });

  it('orders mm2 first, then px2, then other units alphabetically', () => {
    const rows: Row[] = [
      doneRow('a', { area: { value: 1, unit: 'px' } }),
      doneRow('b', { area: { value: 1, unit: 'mm' } }),
      doneRow('c', { area: { value: 1, unit: 'px2' } }),
      doneRow('d', { area: { value: 1, unit: 'mm2' } }),
    ];
    expect(computeTotals(rows).map((t) => t.unit)).toEqual(['mm2', 'px2', 'mm', 'px']);
  });

  it('ignores rows missing the requested metric', () => {
    const rows: Row[] = [
      doneRow('a', { length: { value: 10, unit: 'mm' } }),
      doneRow('b', { area: { value: 20, unit: 'mm2' } }),
    ];
    expect(computeTotals(rows, 'area')).toEqual([{ unit: 'mm2', value: 20, count: 1 }]);
  });

  it('reports the correct count per unit group', () => {
    const rows: Row[] = [
      doneRow('a', { area: { value: 10, unit: 'mm2' } }),
      doneRow('b', { area: { value: 20, unit: 'mm2' } }),
      doneRow('c', { area: { value: 30, unit: 'mm2' } }),
    ];
    expect(computeTotals(rows)[0].count).toBe(3);
  });

  it('sums floating-point values stably, deferring rounding to display', () => {
    const rows: Row[] = [
      doneRow('a', { area: { value: 0.1, unit: 'mm2' } }),
      doneRow('b', { area: { value: 0.2, unit: 'mm2' } }),
    ];
    expect(computeTotals(rows)[0].value).toBeCloseTo(0.3, 10);
  });
});
