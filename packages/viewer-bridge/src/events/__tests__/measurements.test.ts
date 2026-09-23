import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViewerChannel } from '../../ohif/surface.js';

import { subscribeMeasurements } from '../measurements.js';
import { toGeometry, toMetrics } from '../metrics.js';
import { createServices } from '../../__tests__/helpers.js';
import type {
  OhifMeasurement,
  OhifMeasurementEvent,
  OhifMeasurementService,
} from '../../ohif/surface.js';

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

const EVENTS = {
  MEASUREMENT_ADDED: 'MEASUREMENT_ADDED',
  MEASUREMENT_UPDATED: 'MEASUREMENT_UPDATED',
  MEASUREMENT_REMOVED: 'MEASUREMENT_REMOVED',
};

const ellipseWithArea: OhifMeasurement = {
  ...restorableMeasurement,
  data: { 'imageId:image-1': { area: 12.5, areaUnit: 'mm2' } },
};

interface Listening {
  emit: (eventName: string, measurement: unknown) => void;
  send: ReturnType<typeof vi.fn>;
}

const stops: (() => void)[] = [];

const listen = (): Listening => {
  const handlers = new Map<string, (event: OhifMeasurementEvent) => void>();
  const send = vi.fn().mockReturnValue(true);
  const channel: ViewerChannel = {
    send,
    onMessage: vi.fn(),
    getState: vi.fn(),
    subscribe: vi.fn(),
    dispose: vi.fn(),
  };

  const measurementService: OhifMeasurementService = {
    EVENTS,
    subscribe: (eventName, handler) => {
      handlers.set(eventName, handler);
      return { unsubscribe: vi.fn() };
    },
    getMeasurement: vi.fn(),
    remove: vi.fn(),
    jumpToMeasurement: vi.fn(),
  };

  const ohif = {
    services: createServices({ measurementService }),
    commandsManager: { runCommand: vi.fn() },
  };
  stops.push(subscribeMeasurements(ohif, { channel, armedRowId: null, pendingRestore: null }));

  return {
    emit: (eventName, measurement) => {
      handlers.get(eventName)?.({ measurement });
    },
    send,
  };
};

afterEach(() => {
  stops.splice(0).forEach((stop) => {
    stop();
  });
});

describe('what OHIF hands the bridge', () => {
  it('ignores an added event whose measurement is the bare uid string a removal sends, with one warning', () => {
    const { emit, send } = listen();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    emit(EVENTS.MEASUREMENT_ADDED, 'uid-1');

    expect(send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('reports a removed event whose measurement is a bare uid string', () => {
    const { emit, send } = listen();

    emit(EVENTS.MEASUREMENT_REMOVED, 'uid-1');

    expect(send).toHaveBeenCalledWith({ type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1' });
  });

  it('sends the metrics and the geometry of a measurement carrying a key it does not know', () => {
    const { emit, send } = listen();

    emit(EVENTS.MEASUREMENT_ADDED, { ...ellipseWithArea, unmappedByThisBridge: 'a newer OHIF' });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MEASUREMENT_ADDED',
        measurementUid: 'uid-1',
        metrics: { area: { value: 12.5, unit: 'mm2' } },
        geometry: {
          frameOfReferenceUid: 'frame-1',
          referencedImageId: 'image-1',
          points: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          label: 'Lesion A',
        },
      }),
    );
  });

  it('sends nothing for a measurement drawn with a tool the contract does not name', () => {
    const { emit, send } = listen();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    emit(EVENTS.MEASUREMENT_ADDED, { ...ellipseWithArea, toolName: 'FreehandROI' });

    expect(send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
