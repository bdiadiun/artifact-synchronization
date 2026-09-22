import { describe, expect, it } from 'vitest';
import {
  MeasurementGeometry,
  METRIC_KEY_BY_TOOL,
  Metric,
  Metrics,
  ToolName,
  Unit,
  type MetricKey,
} from '../vocabulary';

const expectedMetricKeyByTool: Record<ToolName, MetricKey> = {
  EllipticalROI: 'area',
  RectangleROI: 'area',
  Length: 'length',
};

const geometry: MeasurementGeometry = {
  frameOfReferenceUid: 'for-1',
  referencedImageId: 'image-1',
  points: [
    [1, 2, 3],
    [4, 5, 6],
  ],
};

describe('ToolName', () => {
  it.each(ToolName.options)('maps %s to its metric key', (toolName) => {
    expect(METRIC_KEY_BY_TOOL[toolName]).toBe(expectedMetricKeyByTool[toolName]);
  });

  it('accepts a known tool name', () => {
    expect(ToolName.safeParse('EllipticalROI').success).toBe(true);
  });

  it('refuses a tool name the viewer does not offer', () => {
    expect(ToolName.safeParse('FreehandROI').success).toBe(false);
  });
});

describe('Unit', () => {
  it('accepts a unit the viewer reports', () => {
    expect(Unit.safeParse('mm2').success).toBe(true);
  });

  it('refuses an unknown unit', () => {
    expect(Unit.safeParse('cm2').success).toBe(false);
  });
});

describe('Metric', () => {
  it('accepts a finite value with a known unit', () => {
    expect(Metric.safeParse({ value: 124.5, unit: 'mm2' }).success).toBe(true);
  });

  it('refuses a NaN value', () => {
    expect(Metric.safeParse({ value: NaN, unit: 'mm2' }).success).toBe(false);
  });

  it('refuses an infinite value', () => {
    expect(Metric.safeParse({ value: Infinity, unit: 'mm2' }).success).toBe(false);
  });

  it('refuses a metric carrying an unknown unit', () => {
    expect(Metric.safeParse({ value: 1, unit: 'cm2' }).success).toBe(false);
  });
});

describe('Metrics', () => {
  it('accepts a measurement that reports no metric at all', () => {
    expect(Metrics.safeParse({}).success).toBe(true);
  });

  it('accepts an area on its own', () => {
    expect(Metrics.safeParse({ area: { value: 124.5, unit: 'mm2' } }).success).toBe(true);
  });

  it('accepts a length on its own', () => {
    expect(Metrics.safeParse({ length: { value: 12, unit: 'mm' } }).success).toBe(true);
  });

  it('accepts several metrics keyed by name', () => {
    const parsed = Metrics.safeParse({
      area: { value: 124.5, unit: 'mm2' },
      length: { value: 12, unit: 'mm' },
    });

    expect(parsed.success).toBe(true);
  });

  it('refuses a metric under a key outside the vocabulary', () => {
    expect(Metrics.safeParse({ mean: { value: 40, unit: 'mm' } }).success).toBe(false);
  });

  it('refuses a value that is not a metric', () => {
    expect(Metrics.safeParse({ area: 124.5 }).success).toBe(false);
  });
});

describe('MeasurementGeometry', () => {
  it('accepts world points of three coordinates', () => {
    expect(MeasurementGeometry.safeParse(geometry).success).toBe(true);
  });

  it('refuses a world point of two coordinates', () => {
    expect(MeasurementGeometry.safeParse({ ...geometry, points: [[1, 2]] }).success).toBe(false);
  });

  it('refuses a world point of four coordinates', () => {
    expect(MeasurementGeometry.safeParse({ ...geometry, points: [[1, 2, 3, 4]] }).success).toBe(
      false,
    );
  });

  it('refuses a NaN coordinate', () => {
    expect(MeasurementGeometry.safeParse({ ...geometry, points: [[1, NaN, 3]] }).success).toBe(
      false,
    );
  });

  it('refuses an infinite coordinate', () => {
    expect(MeasurementGeometry.safeParse({ ...geometry, points: [[1, Infinity, 3]] }).success).toBe(
      false,
    );
  });

  it('refuses an empty points array', () => {
    expect(MeasurementGeometry.safeParse({ ...geometry, points: [] }).success).toBe(false);
  });

  it('refuses an empty frameOfReferenceUid', () => {
    expect(MeasurementGeometry.safeParse({ ...geometry, frameOfReferenceUid: '' }).success).toBe(
      false,
    );
  });
});
