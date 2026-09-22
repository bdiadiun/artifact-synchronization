import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMeasurementStream } from '../measurementStream.js';
import type { OhifMeasurementEvent, OhifMeasurementService } from '../ohif.props.js';
import type { MeasurementStreamDeps } from '../measurementStream.props.js';
import type { ReportedMeasurements } from '../reportedMeasurements.props.js';

const EVENTS = {
  MEASUREMENT_ADDED: 'MEASUREMENT_ADDED',
  MEASUREMENT_UPDATED: 'MEASUREMENT_UPDATED',
  MEASUREMENT_REMOVED: 'MEASUREMENT_REMOVED',
};

const createReported = (): ReportedMeasurements => ({
  isReported: vi.fn().mockReturnValue(false),
  isBoundToRow: vi.fn().mockReturnValue(false),
  wasLastSent: vi.fn().mockReturnValue(false),
  reportAdded: vi.fn().mockReturnValue(true),
  reportRemoved: vi.fn(),
  expectRemoval: vi.fn(),
  bindRow: vi.fn(),
  pushUpdate: vi.fn(),
  forget: vi.fn(),
  dispose: vi.fn(),
});

const createDeps = (
  overrides: Partial<MeasurementStreamDeps> = {},
): {
  deps: MeasurementStreamDeps;
  handlers: Map<string, (event: OhifMeasurementEvent) => void>;
} => {
  const handlers = new Map<string, (event: OhifMeasurementEvent) => void>();

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

  const deps: MeasurementStreamDeps = {
    servicesManager: { services: { measurementService } },
    reported: createReported(),
    armed: { getArmed: vi.fn().mockReturnValue(null), disarm: vi.fn() },
    ...overrides,
  };

  return { deps, handlers };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createMeasurementStream MEASUREMENT_ADDED', () => {
  it('drops a payload that is not a measurement object, warning rather than throwing', () => {
    const { deps, handlers } = createDeps();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createMeasurementStream(deps);
    const handleAdded = handlers.get('MEASUREMENT_ADDED');

    expect(() => {
      handleAdded?.({ measurement: 'just-a-uid-string' });
    }).not.toThrow();

    expect(console.warn).toHaveBeenCalled();
    expect(deps.reported.reportAdded).not.toHaveBeenCalled();
  });

  it('reports the armed row id and disarms the tool once the measurement is reported', () => {
    const { deps, handlers } = createDeps({
      armed: {
        getArmed: vi
          .fn()
          .mockReturnValue({ rowId: 'row-1', requestId: 'req-1', previousTool: null }),
        disarm: vi.fn(),
      },
    });
    createMeasurementStream(deps);
    const handleAdded = handlers.get('MEASUREMENT_ADDED');

    handleAdded?.({
      measurement: {
        uid: 'uid-1',
        toolName: 'EllipticalROI',
        referencedImageId: 'image-1',
        data: { 'imageId:image-1': { area: 12.5, areaUnit: 'mm2' } },
      },
    });

    expect(deps.reported.reportAdded).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: 'row-1', measurementUid: 'uid-1', causedBy: 'req-1' }),
    );
    expect(deps.armed.disarm).toHaveBeenCalledTimes(1);
  });

  it('reports rowId: null when nothing is armed (A-8), and does not disarm', () => {
    const { deps, handlers } = createDeps();
    createMeasurementStream(deps);
    const handleAdded = handlers.get('MEASUREMENT_ADDED');

    handleAdded?.({
      measurement: {
        uid: 'uid-1',
        toolName: 'EllipticalROI',
        referencedImageId: 'image-1',
        data: { 'imageId:image-1': { area: 12.5, areaUnit: 'mm2' } },
      },
    });

    expect(deps.reported.reportAdded).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: null }),
    );
    expect(deps.armed.disarm).not.toHaveBeenCalled();
  });

  it('does not report a measurement already reported', () => {
    const { deps, handlers } = createDeps({
      reported: { ...createReported(), isReported: vi.fn().mockReturnValue(true) },
    });
    createMeasurementStream(deps);
    const handleAdded = handlers.get('MEASUREMENT_ADDED');

    handleAdded?.({
      measurement: {
        uid: 'uid-1',
        toolName: 'EllipticalROI',
        referencedImageId: 'image-1',
        data: { 'imageId:image-1': { area: 12.5, areaUnit: 'mm2' } },
      },
    });

    expect(deps.reported.reportAdded).not.toHaveBeenCalled();
  });
});

describe('createMeasurementStream MEASUREMENT_UPDATED', () => {
  it('drops a payload that is not a measurement object', () => {
    const { deps, handlers } = createDeps();
    createMeasurementStream(deps);
    const handleUpdated = handlers.get('MEASUREMENT_UPDATED');

    expect(() => {
      handleUpdated?.({ measurement: 'just-a-uid-string' });
    }).not.toThrow();

    expect(deps.reported.pushUpdate).not.toHaveBeenCalled();
  });

  it('drops an update for a measurement not bound to a row', () => {
    const { deps, handlers } = createDeps();
    createMeasurementStream(deps);
    const handleUpdated = handlers.get('MEASUREMENT_UPDATED');

    handleUpdated?.({
      measurement: {
        uid: 'uid-1',
        toolName: 'EllipticalROI',
        referencedImageId: 'image-1',
        data: { 'imageId:image-1': { area: 12.5, areaUnit: 'mm2' } },
      },
    });

    expect(deps.reported.pushUpdate).not.toHaveBeenCalled();
  });

  it('pushes an update for a measurement bound to a row', () => {
    const { deps, handlers } = createDeps({
      reported: { ...createReported(), isBoundToRow: vi.fn().mockReturnValue(true) },
    });
    createMeasurementStream(deps);
    const handleUpdated = handlers.get('MEASUREMENT_UPDATED');

    handleUpdated?.({
      measurement: {
        uid: 'uid-1',
        toolName: 'EllipticalROI',
        referencedImageId: 'image-1',
        data: { 'imageId:image-1': { area: 12.5, areaUnit: 'mm2' } },
      },
    });

    expect(deps.reported.pushUpdate).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ toolName: 'EllipticalROI' }),
    );
  });
});

describe('createMeasurementStream MEASUREMENT_REMOVED', () => {
  it('reports the removal by uid (the event carries only the uid, not the measurement)', () => {
    const { deps, handlers } = createDeps();
    createMeasurementStream(deps);
    const handleRemoved = handlers.get('MEASUREMENT_REMOVED');

    handleRemoved?.({ measurement: 'uid-1' });

    expect(deps.reported.reportRemoved).toHaveBeenCalledWith('uid-1');
  });

  it('warns and reports nothing for a removal with no uid', () => {
    const { deps, handlers } = createDeps();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createMeasurementStream(deps);
    const handleRemoved = handlers.get('MEASUREMENT_REMOVED');

    handleRemoved?.({ measurement: {} });

    expect(console.warn).toHaveBeenCalled();
    expect(deps.reported.reportRemoved).not.toHaveBeenCalled();
  });
});
