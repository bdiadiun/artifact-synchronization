import type {
  RestoreFailure,
  RestoreFailureReason,
  RestoreMeasurementRequest,
  RestoreMeasurementsCommand,
} from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';
import { annotation } from '@cornerstonejs/tools';
import type { Annotation } from '@cornerstonejs/tools/types';
import { triggerAnnotationRenderForViewportIds } from '@cornerstonejs/tools/utilities';
import type { Types } from '@cornerstonejs/core';

import { LOG_PREFIX, type OhifServices } from './ohif.js';

// A-14 / S-5.6. No value is posted from here: cornerstone recomputes cachedStats in the render
// pass this triggers, and the ordinary MEASUREMENT_UPDATED path delivers it.

export interface RestoreCommands {
  handleRestore: (command: RestoreMeasurementsCommand) => void;
  dispose: () => void;
}

const failAll = (
  measurements: RestoreMeasurementRequest[],
  reason: RestoreFailureReason,
): RestoreFailure[] => measurements.map(({ rowId }) => ({ rowId, reason }));

// The contract guarantees three finite numbers per point (primitiveGuards.ts isPoints), which is
// cornerstone's world point; the guard admitted this command before it reached us.
const toWorldPoint = ([x, y, z]: number[]): Types.Point3 => [x, y, z];

// Hand-built rather than EllipticalROITool.hydrate: that one re-derives metadata from the live
// camera, needs an enabled element and drops the label (ohif-annotation-restore.md §1).
const toAnnotation = ({
  measurementUid,
  toolName,
  geometry,
}: RestoreMeasurementRequest): Annotation => ({
  annotationUID: measurementUid,
  metadata: {
    toolName,
    FrameOfReferenceUID: geometry.frameOfReferenceUid,
    referencedImageId: geometry.referencedImageId,
  },
  data: {
    // activeHandleIndex must be null, not absent: the renderer treats `!== null` as "a handle is
    // active" and then indexes the canvas coordinates with undefined (EllipticalROITool.js:445).
    handles: { points: geometry.points.map(toWorldPoint), activeHandleIndex: null },
    label: geometry.label,
  },
  // Makes cornerstone recompute the stats and emit ANNOTATION_MODIFIED afterwards.
  invalidated: true,
});

const restoreRow = (
  services: OhifServices,
  request: RestoreMeasurementRequest,
): RestoreFailureReason | null => {
  if (services.measurementService?.getMeasurement(request.measurementUid)) {
    return 'already-present';
  }

  try {
    // The selector is only read when it is an enabled HTMLDivElement (annotationState.js:59-68);
    // for any string the group key comes from metadata.FrameOfReferenceUID (addSRAnnotation.ts:142).
    annotation.state.addAnnotation(toAnnotation(request), request.geometry.frameOfReferenceUid);
    return null;
  } catch (error) {
    console.error(`${LOG_PREFIX} restoring ${request.measurementUid} failed`, error);
    return 'viewer-error';
  }
};

// The study the viewer shows is the one its loaded display sets belong to
// (DisplaySetService.ts:114, getActiveDisplaySets).
const showsStudy = (services: OhifServices, studyInstanceUid: string): boolean =>
  (services.displaySetService?.getActiveDisplaySets() ?? []).some(
    (displaySet) => displaySet.StudyInstanceUID === studyInstanceUid,
  );

const runRestore = (
  services: OhifServices,
  channel: ViewerChannel,
  command: RestoreMeasurementsCommand,
): void => {
  const restored: string[] = [];
  const failed: RestoreFailure[] = showsStudy(services, command.studyInstanceUid)
    ? []
    : failAll(command.measurements, 'unknown-study');

  if (failed.length === 0) {
    command.measurements.forEach((request) => {
      const reason = restoreRow(services, request);
      if (reason === null) {
        restored.push(request.rowId);
      } else {
        failed.push({ rowId: request.rowId, reason });
      }
    });
  }

  const viewportId = services.viewportGridService?.getActiveViewportId();

  if (restored.length > 0 && viewportId) {
    triggerAnnotationRenderForViewportIds([viewportId]);
  }

  channel.reply(command, { restored, failed });
};

export const createRestore = (services: OhifServices, channel: ViewerChannel): RestoreCommands => {
  const { cornerstoneViewportService, viewportGridService } = services;
  const gates = new Set<{ unsubscribe: () => void }>();

  const holdsData = (): boolean => {
    const viewportId = viewportGridService?.getActiveViewportId();
    return Boolean(viewportId && cornerstoneViewportService?.getCornerstoneViewport(viewportId));
  };

  // The viewport holds a cornerstone viewport only once its display set data has been set
  // (CornerstoneViewportService.ts:509), the moment VIEWPORT_DATA_CHANGED reports (:492, :1229).
  const whenReady = (run: () => void): void => {
    if (holdsData() || !cornerstoneViewportService) {
      run();
      return;
    }

    const subscription = cornerstoneViewportService.subscribe(
      cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
      () => {
        subscription.unsubscribe();
        gates.delete(subscription);
        run();
      },
    );

    gates.add(subscription);
  };

  return {
    handleRestore: (command: RestoreMeasurementsCommand): void => {
      whenReady(() => {
        runRestore(services, channel, command);
      });
    },

    dispose: (): void => {
      gates.forEach((subscription) => {
        subscription.unsubscribe();
      });
      gates.clear();
    },
  };
};
