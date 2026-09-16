import { describe, expect, it } from 'vitest';
import { formatMetric } from './format';

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
