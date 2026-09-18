import { describe, expect, it } from 'vitest';
import { formatMetric, formatRowKind, formatRowMetric, formatRowStatus } from '../format';
import { RowStatus, type Row } from '../rows';
import { UI } from '../../ui-strings';

describe('formatMetric', () => {
  it('renders mm2 with the mm² glyph and 1 decimal', () => {
    expect(formatMetric({ value: 124.5, unit: 'mm2' })).toBe('124.5 mm²');
  });

  it('renders px2 with the px² glyph', () => {
    expect(formatMetric({ value: 3200, unit: 'px2' })).toBe('3200.0 px²');
  });

  it('rounds to 1 decimal', () => {
    expect(formatMetric({ value: 124.567, unit: 'mm2' })).toBe('124.6 mm²');
  });
});

const row = (over: Partial<Row> = {}): Row => ({
  rowId: 'row-1',
  status: RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  measurementUid: 'uid-1',
  geometry: null,
  restoreFailureReason: null,
  ...over,
});

describe('formatRowStatus', () => {
  it('maps every status to its Ukrainian label', () => {
    expect(formatRowStatus(RowStatus.Pending)).toBe(UI.statusPending);
    expect(formatRowStatus(RowStatus.Drawing)).toBe(UI.statusDrawing);
    expect(formatRowStatus(RowStatus.Done)).toBe(UI.statusDone);
  });
});

describe('formatRowKind', () => {
  it('labels an area tool as area', () => {
    expect(formatRowKind(row({ toolName: 'RectangleROI' }))).toBe(UI.kindArea);
  });

  it('labels the length tool as length', () => {
    expect(formatRowKind(row({ toolName: 'Length' }))).toBe(UI.kindLength);
  });
});

describe('formatRowMetric', () => {
  it('shows the metric that matches the row tool', () => {
    expect(formatRowMetric(row())).toBe('124.5 mm²');
  });

  it('returns null while the row is not done', () => {
    expect(formatRowMetric(row({ status: RowStatus.Drawing }))).toBeNull();
  });

  it('returns null when the row carries no metrics', () => {
    expect(formatRowMetric(row({ metrics: null }))).toBeNull();
  });

  it('falls back to the first metric, keyed, when the tool metric is missing', () => {
    const fallback = row({ metrics: { perimeter: { value: 40, unit: 'mm' } } });

    expect(formatRowMetric(fallback)).toBe('perimeter: 40.0 mm');
  });

  it('returns null for an empty metrics payload', () => {
    expect(formatRowMetric(row({ metrics: {} }))).toBeNull();
  });
});
