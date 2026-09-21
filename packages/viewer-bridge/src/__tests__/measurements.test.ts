import { afterEach, describe, expect, it, vi } from 'vitest';

import { toMetrics } from '../measurements.js';
import type { OhifMeasurementLike } from '../measurements.props.js';

const ellipticalWithArea = (areaUnit: string): OhifMeasurementLike => ({
  uid: 'uid-1',
  toolName: 'EllipticalROI',
  referencedImageId: 'image-1',
  data: {
    'imageId:image-1': { area: 12.5, areaUnit },
  },
});

const lengthWith = (unit: string): OhifMeasurementLike => ({
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

  it('logs quietly instead of warning when the caller asks for a quiet check', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    toMetrics(ellipticalWithArea('cm²'), { quiet: true });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();
  });
});
