import type { MeasurementRemovedEvent, RemoveMeasurementCommand } from '@bdiadiun/scoring-contract';

import { LOG_PREFIX } from './config.js';
import type { OhifServicesManager } from './ohif.props.js';
import type { PostToHost } from './messaging.props.js';

export interface RemovalCommandsDeps {
  servicesManager: OhifServicesManager;
  post: PostToHost;
  forget: (uid: string) => void;
}

export interface RemovalCommands {
  handleRemove: (command: RemoveMeasurementCommand) => void;
  takeCause: (uid: string) => string | undefined;
}

// P-6 / A-10, the echo-loop point: causedBy lets the host recognise its own echo, and
// idempotency (unknown uid -> no remove() call) ends a loop even for a host that ignores it.

export const createRemovalCommands = ({
  servicesManager,
  post,
  forget,
}: RemovalCommandsDeps): RemovalCommands => {
  const { measurementService } = servicesManager.services;

  const pendingRemovals = new Map<string, string>();

  const handleRemove = (command: RemoveMeasurementCommand): void => {
    const { measurementUid, requestId, rowId } = command;

    if (!measurementService) {
      console.warn(
        `${LOG_PREFIX} REMOVE_MEASUREMENT ${requestId}: measurementService unavailable; ignored`,
      );
      return;
    }

    // A-10 idempotency: our own "no measurement -> no event" guarantee, not remove()'s silent
    // return (MeasurementService.ts:675-680).
    if (!measurementService.getMeasurement(measurementUid)) {
      console.debug(
        `${LOG_PREFIX} REMOVE_MEASUREMENT ${requestId}: measurement ${measurementUid} (row ${rowId}) is already gone; answering without removing`,
      );
      forget(measurementUid);
      // Answered anyway, so the host's exchange settles at once instead of waiting for its
      // timeout.
      const event: MeasurementRemovedEvent = {
        version: 1,
        type: 'MEASUREMENT_REMOVED',
        measurementUid,
        causedBy: requestId,
      };
      post(event);
      return;
    }

    // Parked before the call: remove() broadcasts synchronously (MeasurementService.ts:674-689).
    pendingRemovals.set(measurementUid, requestId);

    try {
      // The removeMeasurement command only wraps this call (commandsModule.ts:746-751); cornerstone
      // erases the drawing on MEASUREMENT_REMOVED (initMeasurementService.ts:501-522).
      measurementService.remove(measurementUid);
    } finally {
      // If remove() threw, a stale requestId would be stamped on a later unrelated deletion.
      pendingRemovals.delete(measurementUid);
    }

    forget(measurementUid);
    console.debug(
      `${LOG_PREFIX} REMOVE_MEASUREMENT ${requestId}: removed ${measurementUid} (row ${rowId})`,
    );
  };

  return {
    handleRemove,
    takeCause: (uid: string): string | undefined => {
      const requestId = pendingRemovals.get(uid);
      pendingRemovals.delete(uid);
      return requestId;
    },
  };
};
