import { describe, expect, it } from 'vitest';
import {
  isFiniteNumber,
  isMeasurementGeometry,
  isNonEmptyString,
  isOneOf,
  isRecord,
  isToolName,
} from '../primitiveGuards';
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

describe('isFiniteNumber', () => {
  it('accepts a finite number', () => {
    expect(isFiniteNumber(124.5)).toBe(true);
  });

  it('rejects NaN', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
  });

  it('rejects a numeric string', () => {
    expect(isFiniteNumber('42')).toBe(false);
  });
});

describe('isOneOf', () => {
  const isColor = isOneOf(['red', 'green', 'blue'] as const);

  it('accepts a member of the given values', () => {
    expect(isColor('green')).toBe(true);
  });

  it('rejects a string that is not a member', () => {
    expect(isColor('purple')).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(isColor(42)).toBe(false);
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
