import { describe, expect, it } from 'vitest';
import { isMeasurementGeometry, isNonEmptyString, isRecord, isToolName } from '../primitiveGuards';
import type { MeasurementGeometry } from '../index';

const geometry: MeasurementGeometry = {
  frameOfReferenceUid: 'for-1',
  referencedImageId: 'image-1',
  points: [
    [1, 2, 3],
    [4, 5, 6],
  ],
};

describe('isRecord', () => {
  it('accepts a plain object', () => {
    expect(isRecord({})).toBe(true);
  });

  it('rejects an array', () => {
    expect(isRecord([])).toBe(false);
  });

  it('rejects null', () => {
    expect(isRecord(null)).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('accepts a non-empty string', () => {
    expect(isNonEmptyString('row-1')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isNonEmptyString('')).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(isNonEmptyString(42)).toBe(false);
  });
});

describe('isToolName', () => {
  it('accepts a known tool name', () => {
    expect(isToolName('EllipticalROI')).toBe(true);
  });

  it('rejects an unknown tool name', () => {
    expect(isToolName('FreehandROI')).toBe(false);
  });
});

describe('isMeasurementGeometry', () => {
  it('accepts a valid geometry', () => {
    expect(isMeasurementGeometry(geometry)).toBe(true);
  });

  it('rejects geometry with a non-finite point value', () => {
    const badGeometry = { ...geometry, points: [[1, Infinity, 3]] };
    expect(isMeasurementGeometry(badGeometry)).toBe(false);
  });

  it('rejects geometry with an empty points array', () => {
    const badGeometry = { ...geometry, points: [] };
    expect(isMeasurementGeometry(badGeometry)).toBe(false);
  });

  it('rejects geometry with a two-coordinate point', () => {
    const badGeometry = { ...geometry, points: [[1, 2]] };
    expect(isMeasurementGeometry(badGeometry)).toBe(false);
  });

  it('rejects geometry with a four-coordinate point', () => {
    const badGeometry = { ...geometry, points: [[1, 2, 3, 4]] };
    expect(isMeasurementGeometry(badGeometry)).toBe(false);
  });

  it('accepts geometry with a three-coordinate point', () => {
    const goodGeometry = { ...geometry, points: [[1, 2, 3]] };
    expect(isMeasurementGeometry(goodGeometry)).toBe(true);
  });
});
