import type { Metrics } from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import { LOG_PREFIX } from './config.js';
import { createThrottledEmitter } from './throttle.js';
import type { ThrottledEmitter } from './throttle.js';
import type {
  AddedPayload,
  MeasurementUpdate,
  ReportedMeasurements,
  ReportedMeasurementsDeps,
} from './reportedMeasurements.props.js';

// Ten updates a second follow a drag without visible lag and cut a 60 fps drag six-fold.
const UPDATE_INTERVAL_MS = 100;

const createUpdateEmitter = (
  send: ViewerChannel['send'],
  lastSentMetrics: Map<string, string>,
): ThrottledEmitter<MeasurementUpdate> => {
  const emitUpdate = (uid: string, { toolName, metrics, geometry }: MeasurementUpdate): void => {
    const payload = { measurementUid: uid, toolName, metrics, geometry };

    if (!send('MEASUREMENT_UPDATED', payload)) {
      return;
    }

    lastSentMetrics.set(uid, JSON.stringify(metrics));
    console.debug(`${LOG_PREFIX} MEASUREMENT_UPDATED sent`, payload);
  };

  return createThrottledEmitter<MeasurementUpdate>(UPDATE_INTERVAL_MS, emitUpdate);
};

export const createReportedMeasurements = ({
  send,
}: ReportedMeasurementsDeps): ReportedMeasurements => {
  // A-8: needed because MEASUREMENT_REMOVED carries only the uid (MeasurementService.ts:686-689).
  const uidToRowId = new Map<string, string>();

  // Single ADDED per uid is an OHIF detail (MeasurementService.ts:572-574), not a contract; a
  // duplicate would double the total. uidToRowId cannot serve: unarmed uids never enter it.
  const reportedUids = new Set<string>();

  // No causedBy on UPDATED (A-10): no command calls measurementService.update(), the OHIF loop
  // point (MeasurementService.ts:365-386), so an update always comes from the user's drag.
  const lastSentMetrics = new Map<string, string>();

  const removalCauses = new Map<string, string>();
  const updateEmitter = createUpdateEmitter(send, lastSentMetrics);

  const forget = (uid: string): void => {
    uidToRowId.delete(uid);
    reportedUids.delete(uid);
    lastSentMetrics.delete(uid);
    removalCauses.delete(uid);
    // Discard, not flush: a trailing UPDATED after REMOVED would resurrect the cleared row.
    updateEmitter.discard(uid);
  };

  return {
    isReported: (uid: string): boolean => reportedUids.has(uid),
    isBoundToRow: (uid: string): boolean => uidToRowId.has(uid),
    wasLastSent: (uid: string, metrics: Metrics): boolean =>
      JSON.stringify(metrics) === lastSentMetrics.get(uid),

    reportAdded: (payload: AddedPayload): boolean => {
      if (!send('MEASUREMENT_ADDED', payload)) {
        return false;
      }

      const { measurementUid, rowId, metrics } = payload;
      reportedUids.add(measurementUid);
      lastSentMetrics.set(measurementUid, JSON.stringify(metrics));

      if (rowId !== null) {
        uidToRowId.set(measurementUid, rowId);
      }

      console.debug(`${LOG_PREFIX} MEASUREMENT_ADDED sent`, payload);
      return true;
    },

    reportRemoved: (uid: string): void => {
      // P-6 / A-10: the cause is what lets the host recognise the echo of its own command.
      const payload = { measurementUid: uid, causedBy: removalCauses.get(uid) };
      forget(uid);

      if (!send('MEASUREMENT_REMOVED', payload)) {
        return;
      }

      console.debug(`${LOG_PREFIX} MEASUREMENT_REMOVED sent`, payload);
    },

    expectRemoval: (uid: string, requestId: string): void => {
      removalCauses.set(uid, requestId);
    },

    // A-14: a restored annotation never broadcasts MEASUREMENT_ADDED, so its row binding is
    // seeded here before the add, or its MEASUREMENT_UPDATED would be dropped as unbound.
    bindRow: (uid: string, rowId: string): void => {
      uidToRowId.set(uid, rowId);
    },

    pushUpdate: (uid: string, update: MeasurementUpdate): void => {
      updateEmitter.push(uid, update);
    },

    forget,

    dispose: (): void => {
      updateEmitter.dispose();
      lastSentMetrics.clear();
      reportedUids.clear();
      uidToRowId.clear();
      removalCauses.clear();
    },
  };
};
