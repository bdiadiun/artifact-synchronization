import type {
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementUpdatedEvent,
  ViewerReadyEvent,
} from '@bdiadiun/scoring-contract';
import { measure } from './metrics.js';
import {
  LOG_PREFIX,
  type OhifCommandsManager,
  type OhifMeasurementEvent,
  type OhifServices,
} from './surface.js';
import { createThrottledEmitter } from './throttle.js';
import { VIEWER_VERSION } from './version.js';

const UPDATE_INTERVAL_MS = 100;

export type OhifEvent =
  | MeasurementAddedEvent
  | MeasurementUpdatedEvent
  | MeasurementRemovedEvent
  | ViewerReadyEvent
  | { type: 'VIEWPORT_DATA_CHANGED' };

export interface Ohif {
  services: OhifServices;
  commandsManager: OhifCommandsManager;
  on: (handler: (event: OhifEvent) => void) => () => void;
}

export const createOhif = (services: OhifServices, commandsManager: OhifCommandsManager): Ohif => {
  const { measurementService, toolGroupService, cornerstoneViewportService } = services;

  const on = (handler: (event: OhifEvent) => void): (() => void) => {
    const updates = createThrottledEmitter(UPDATE_INTERVAL_MS, handler);
    const ready: ViewerReadyEvent = { type: 'VIEWER_READY', viewerVersion: VIEWER_VERSION };

    const added = (payload: OhifMeasurementEvent): void => {
      const measured = measure(payload);

      if (measured === null) {
        console.warn(
          `${LOG_PREFIX} MEASUREMENT_ADDED without metrics; ignored`,
          payload.measurement,
        );
        return;
      }

      handler({ type: 'MEASUREMENT_ADDED', rowId: null, ...measured });
    };

    const updated = (payload: OhifMeasurementEvent): void => {
      const measured = measure(payload);

      if (measured !== null) {
        updates.push(measured.measurementUid, { type: 'MEASUREMENT_UPDATED', ...measured });
      }
    };

    const removed = ({ measurement }: OhifMeasurementEvent): void => {
      if (typeof measurement !== 'string' || measurement.length === 0) {
        console.warn(`${LOG_PREFIX} MEASUREMENT_REMOVED without a uid; ignored`, measurement);
        return;
      }

      updates.discard(measurement);
      handler({ type: 'MEASUREMENT_REMOVED', measurementUid: measurement });
    };

    const viewportAdded = (): void => {
      handler(ready);
    };

    const viewportData = (): void => {
      handler({ type: 'VIEWPORT_DATA_CHANGED' });
    };

    const { EVENTS } = measurementService;
    const subscriptions = [
      measurementService.subscribe(EVENTS.MEASUREMENT_ADDED, added),
      measurementService.subscribe(EVENTS.MEASUREMENT_UPDATED, updated),
      measurementService.subscribe(EVENTS.MEASUREMENT_REMOVED, removed),
      toolGroupService.subscribe(toolGroupService.EVENTS.VIEWPORT_ADDED, viewportAdded),
      cornerstoneViewportService.subscribe(
        cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
        viewportData,
      ),
    ];

    if (toolGroupService.getToolGroup() !== undefined) {
      handler(ready);
    }

    return () => {
      subscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
      updates.clear();
    };
  };

  return { services, commandsManager, on };
};
