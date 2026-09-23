import { afterEach, describe, expect, it, vi } from 'vitest';

import { toGeometry, toMetrics } from '../metrics.js';
import type { OhifMeasurement } from '../metrics.js';

const ellipticalWithArea = (areaUnit: string): OhifMeasurement => ({
  uid: 'uid-1',
  toolName: 'EllipticalROI',
  referencedImageId: 'image-1',
  data: {
    'imageId:image-1': { area: 12.5, areaUnit },
  },
});

const lengthWith = (unit: string): OhifMeasurement => ({
  uid: 'uid-2',
  toolName: 'Length',
  referencedImageId: 'image-1',
  data: {
    'imageId:image-1': { length: 3.2, unit },
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toMetrics', () => {
  it.each([
    ['mm²', 'mm2'],
    ['mm2', 'mm2'],
    ['px²', 'px2'],
    ['px2', 'px2'],
    ['pixels²', 'px2'],
    ['pixels2', 'px2'],
  ] as const)('reads an area measurement with unit spelling %s as %s', (raw, expected) => {
    const metrics = toMetrics(ellipticalWithArea(raw));

    expect(metrics).toEqual({ area: { value: 12.5, unit: expected } });
  });

  it.each([
    ['mm', 'mm'],
    ['px', 'px'],
    ['pixels', 'px'],
  ] as const)('reads a length measurement with unit spelling %s as %s', (raw, expected) => {
    const metrics = toMetrics(lengthWith(raw));

    expect(metrics).toEqual({ length: { value: 3.2, unit: expected } });
  });

  it('refuses an unrecognised area unit rather than guessing one', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const metrics = toMetrics(ellipticalWithArea('cm²'));

    expect(metrics).toBeNull();
  });

  it('refuses a length measurement with no unit at all', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const metrics = toMetrics(lengthWith(''));

    expect(metrics).toBeNull();
  });

  it('refuses a tool it has no metric mapping for', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const metrics = toMetrics({ uid: 'uid-3', toolName: 'FreehandROI' });

    expect(metrics).toBeNull();
  });
});

const restorableMeasurement: OhifMeasurement = {
  uid: 'uid-1',
  toolName: 'EllipticalROI',
  referencedImageId: 'image-1',
  points: [
    [1, 2, 3],
    [4, 5, 6],
  ],
  label: 'Lesion A',
  metadata: { FrameOfReferenceUID: 'frame-1' },
};

describe('toGeometry', () => {
  it('builds restorable geometry from a complete measurement', () => {
    const geometry = toGeometry(restorableMeasurement);

    expect(geometry).toEqual({
      frameOfReferenceUid: 'frame-1',
      referencedImageId: 'image-1',
      points: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      label: 'Lesion A',
    });
  });

  it('copies the points rather than sharing cornerstone live arrays', () => {
    const originalPoints = [
      [1, 2, 3],
      [4, 5, 6],
    ];

    const geometry = toGeometry({ ...restorableMeasurement, points: originalPoints });

    expect(geometry?.points).not.toBe(originalPoints);
    expect(geometry?.points[0]).not.toBe(originalPoints[0]);
  });

  it('is undefined without a frame of reference', () => {
    const geometry = toGeometry({ ...restorableMeasurement, metadata: {} });

    expect(geometry).toBeUndefined();
  });

  it('is undefined without a referenced image id', () => {
    const geometry = toGeometry({ ...restorableMeasurement, referencedImageId: undefined });

    expect(geometry).toBeUndefined();
  });

  it('is undefined without any points', () => {
    const geometry = toGeometry({ ...restorableMeasurement, points: undefined });

    expect(geometry).toBeUndefined();
  });

  it('is undefined when a point is missing its z coordinate', () => {
    const geometry = toGeometry({ ...restorableMeasurement, points: [[1, 2]] });

    expect(geometry).toBeUndefined();
  });
});
