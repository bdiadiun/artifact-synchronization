import { afterEach, describe, expect, it, vi } from 'vitest';

import { toGeometry } from '../geometry.js';
import type { OhifMeasurementLike } from '../measurements.props.js';

const completeMeasurement: OhifMeasurementLike = {
  uid: 'uid-1',
  referencedImageId: 'image-1',
  points: [
    [1, 2, 3],
    [4, 5, 6],
  ],
  label: 'Lesion A',
  metadata: { FrameOfReferenceUID: 'frame-1' },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toGeometry', () => {
  it('builds restorable geometry from a complete measurement', () => {
    const geometry = toGeometry(completeMeasurement);

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
    const geometry = toGeometry({ ...completeMeasurement, points: originalPoints });

    expect(geometry?.points).not.toBe(originalPoints);
    expect(geometry?.points[0]).not.toBe(originalPoints[0]);
  });

  it('is undefined without a frame of reference', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const geometry = toGeometry({ ...completeMeasurement, metadata: {} });

    expect(geometry).toBeUndefined();
  });

  it('is undefined without a referenced image id', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const geometry = toGeometry({ ...completeMeasurement, referencedImageId: undefined });

    expect(geometry).toBeUndefined();
  });

  it('is undefined without any points', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const geometry = toGeometry({ ...completeMeasurement, points: undefined });

    expect(geometry).toBeUndefined();
  });

  it('is undefined when a point is missing its z coordinate', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const geometry = toGeometry({ ...completeMeasurement, points: [[1, 2]] });

    expect(geometry).toBeUndefined();
  });
});
