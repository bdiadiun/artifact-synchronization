import type { Bridge, Ohif } from '../bridge.js';
import { activateTool, DEFAULT_TOOL } from '../commands/handlers.js';
import { LOG_PREFIX, type OhifMeasurementEvent } from '../ohif/surface.js';
import { createThrottledEmitter } from '../ohif/throttle.js';
import { measure } from './metrics.js';

const UPDATE_INTERVAL_MS = 100;

// Every measurement OHIF announces goes to the host; the one drawn while a row was armed carries
// that row's id and hands the viewer back to the default tool (A-8, A-23). Updates are throttled
// per measurement so a dragged handle reaches the form live but not on every frame (S-5.1).
export const subscribeMeasurements = (ohif: Ohif, bridge: Bridge): (() => void) => {
  const { measurementService } = ohif.services;
  const { channel } = bridge;
  const updates = createThrottledEmitter(UPDATE_INTERVAL_MS, channel.send);

  const handleAdded = (event: OhifMeasurementEvent): void => {
    const measured = measure(event);

    if (measured === null) {
      console.warn(`${LOG_PREFIX} MEASUREMENT_ADDED without metrics; ignored`, event.measurement);
      return;
    }

    const rowId = bridge.armedRowId;
    bridge.armedRowId = null;
    channel.send({ type: 'MEASUREMENT_ADDED', rowId, ...measured });

    if (rowId !== null) {
      activateTool(ohif, DEFAULT_TOOL);
    }
  };

  const handleUpdated = (event: OhifMeasurementEvent): void => {
    const measured = measure(event);

    if (measured !== null) {
      updates.push(measured.measurementUid, { type: 'MEASUREMENT_UPDATED', ...measured });
    }
  };

  const handleRemoved = ({ measurement }: OhifMeasurementEvent): void => {
    if (typeof measurement !== 'string' || measurement.length === 0) {
      console.warn(`${LOG_PREFIX} MEASUREMENT_REMOVED without a uid; ignored`, measurement);
      return;
    }

    updates.discard(measurement);
    channel.send({ type: 'MEASUREMENT_REMOVED', measurementUid: measurement });
  };

  const { EVENTS } = measurementService;
  const subscriptions = [
    measurementService.subscribe(EVENTS.MEASUREMENT_ADDED, handleAdded),
    measurementService.subscribe(EVENTS.MEASUREMENT_UPDATED, handleUpdated),
    measurementService.subscribe(EVENTS.MEASUREMENT_REMOVED, handleRemoved),
  ];

  return (): void => {
    subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    updates.dispose();
  };
};
