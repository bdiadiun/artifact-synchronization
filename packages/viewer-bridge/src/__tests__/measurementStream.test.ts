import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMeasurementStream } from '../measurementStream.js';
import type { OhifMeasurementEvent, OhifMeasurementService } from '../ohif.props.js';
import type { MeasurementStreamDeps } from '../measurementStream.props.js';

const EVENTS = {
  MEASUREMENT_ADDED: 'MEASUREMENT_ADDED',
  MEASUREMENT_UPDATED: 'MEASUREMENT_UPDATED',
  MEASUREMENT_REMOVED: 'MEASUREMENT_REMOVED',
};

const createDeps = (): {
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
    post: vi.fn().mockReturnValue(true),
    reported: {
      isReported: vi.fn().mockReturnValue(false),
      isBoundToRow: vi.fn().mockReturnValue(false),
      wasLastSent: vi.fn().mockReturnValue(false),
      recordAdded: vi.fn(),
      bindRow: vi.fn(),
      pushUpdate: vi.fn(),
      forget: vi.fn(),
      dispose: vi.fn(),
    },
    getArmed: vi.fn().mockReturnValue(null),
    disarm: vi.fn(),
    takeCause: vi.fn(),
  };

  return { deps, handlers };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createMeasurementStream', () => {
  it('drops a MEASUREMENT_ADDED payload that is not a measurement object, warning rather than throwing', () => {
    const { deps, handlers } = createDeps();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createMeasurementStream(deps);
    const handleAdded = handlers.get('MEASUREMENT_ADDED');

    expect(() => {
      handleAdded?.({ measurement: 'just-a-uid-string' });
    }).not.toThrow();

    expect(console.warn).toHaveBeenCalled();
    expect(deps.post).not.toHaveBeenCalled();
  });

  it('drops a MEASUREMENT_UPDATED payload that is not a measurement object', () => {
    const { deps, handlers } = createDeps();
    createMeasurementStream(deps);
    const handleUpdated = handlers.get('MEASUREMENT_UPDATED');

    expect(() => {
      handleUpdated?.({ measurement: 'just-a-uid-string' });
    }).not.toThrow();

    expect(deps.reported.pushUpdate).not.toHaveBeenCalled();
  });
});
