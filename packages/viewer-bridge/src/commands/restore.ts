import type {
  RestoreFailure,
  RestoreFailureReason,
  RestoreMeasurementRequest,
  RestoreMeasurementsCommand,
} from '@bdiadiun/scoring-contract';
import { annotation } from '@cornerstonejs/tools';
import type { Annotation } from '@cornerstonejs/tools/types';
import { triggerAnnotationRenderForViewportIds } from '@cornerstonejs/tools/utilities';
import type { Types } from '@cornerstonejs/core';

import type { Bridge } from '../bridge.js';
import type { Ohif } from '../ohif/facade.js';
import { LOG_PREFIX, type OhifServices, type ViewerChannel } from '../ohif/surface.js';

const toAnnotation = ({ measurementUid, toolName, geometry }: RestoreMeasurementRequest): Annotation => ({
  annotationUID: measurementUid,
  metadata: {
    toolName,
    FrameOfReferenceUID: geometry.frameOfReferenceUid,
    referencedImageId: geometry.referencedImageId,
  },
  data: {
    handles: { points: geometry.points as Types.Point3[], activeHandleIndex: null },
    label: geometry.label,
  },
  invalidated: true,
});

const restoreRow = (services: OhifServices, request: RestoreMeasurementRequest): RestoreFailureReason | null => {
  if (services.measurementService.getMeasurement(request.measurementUid)) {
    return 'already-present';
  }

  try {
    annotation.state.addAnnotation(toAnnotation(request), request.geometry.frameOfReferenceUid);
    return null;
  } catch (error) {
    console.error(`${LOG_PREFIX} restoring ${request.measurementUid} failed`, error);
    return 'viewer-error';
  }
};

const showsStudy = (services: OhifServices, studyInstanceUid: string): boolean =>
  services.displaySetService
    .getActiveDisplaySets()
    .some((displaySet) => displaySet.StudyInstanceUID === studyInstanceUid);

export const runRestore = (
  services: OhifServices,
  channel: ViewerChannel,
  command: RestoreMeasurementsCommand,
): void => {
  const studyShown = showsStudy(services, command.studyInstanceUid);
  const restored: string[] = [];
  const failed: RestoreFailure[] = [];

  for (const request of command.measurements) {
    const reason = studyShown ? restoreRow(services, request) : 'unknown-study';
    if (reason === null) {
      restored.push(request.rowId);
    } else {
      failed.push({ rowId: request.rowId, reason });
    }
  }

  const viewportId = services.viewportGridService.getActiveViewportId();

  if (restored.length > 0 && viewportId) {
    triggerAnnotationRenderForViewportIds([viewportId]);
  }

  channel.send({ type: 'MEASUREMENTS_RESTORED', restored, failed });
};

export const holdsViewportData = (services: OhifServices): boolean => {
  const viewportId = services.viewportGridService.getActiveViewportId();
  return Boolean(viewportId && services.cornerstoneViewportService.getCornerstoneViewport(viewportId));
};

export const restorePending = (ohif: Ohif, bridge: Bridge): void => {
  const command = bridge.pendingRestore;

  if (command !== null && holdsViewportData(ohif.services)) {
    bridge.pendingRestore = null;
    runRestore(ohif.services, bridge.channel, command);
  }
};
