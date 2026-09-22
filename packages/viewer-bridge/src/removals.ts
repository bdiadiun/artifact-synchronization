import type { RemoveMeasurementCommand } from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import { LOG_PREFIX } from './config.js';
import type { OhifServicesManager } from './ohif.props.js';
import type { ReportedMeasurements } from './reportedMeasurements.props.js';

export interface RemovalCommandsDeps {
  servicesManager: OhifServicesManager;
  send: ViewerChannel['send'];
  reported: ReportedMeasurements;
}

export interface RemovalCommands {
  handleRemove: (command: RemoveMeasurementCommand) => void;
}

// P-6 / A-10, the echo-loop point: causedBy lets the host recognise its own echo, and
// idempotency (unknown uid -> no remove() call) ends a loop even for a host that ignores it.

export const createRemovalCommands = ({
  servicesManager,
  send,
  reported,
}: RemovalCommandsDeps): RemovalCommands => {
  const { measurementService } = servicesManager.services;

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
      reported.forget(measurementUid);
      // Answered anyway, so the host's exchange settles at once instead of waiting for its
      // timeout.
      send('MEASUREMENT_REMOVED', { measurementUid, causedBy: requestId });
      return;
    }

    // Parked before the call: remove() broadcasts synchronously (MeasurementService.ts:674-689),
    // and the stream's removed handler is what stamps the cause on the outgoing event.
    reported.expectRemoval(measurementUid, requestId);

    try {
      // The removeMeasurement command only wraps this call (commandsModule.ts:746-751); cornerstone
      // erases the drawing on MEASUREMENT_REMOVED (initMeasurementService.ts:501-522).
      measurementService.remove(measurementUid);
    } finally {
      // Also clears the expectation: if remove() threw, a stale requestId would be stamped on a
      // later unrelated deletion.
      reported.forget(measurementUid);
    }

    console.debug(
      `${LOG_PREFIX} REMOVE_MEASUREMENT ${requestId}: removed ${measurementUid} (row ${rowId})`,
    );
  };

  return { handleRemove };
};
