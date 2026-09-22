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

export interface RestoreCommands {
  handleRestore: (command: RestoreMeasurementsCommand) => void;
  dispose: () => void;
}

const failAll = (
  measurements: RestoreMeasurementRequest[],
  reason: RestoreFailureReason,
): RestoreFailure[] => measurements.map(({ rowId }) => ({ rowId, reason }));

const toWorldPoint = ([x, y, z]: number[]): Types.Point3 => [x, y, z];

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
    handles: { points: geometry.points.map(toWorldPoint), activeHandleIndex: null },
    label: geometry.label,
  },
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
    annotation.state.addAnnotation(toAnnotation(request), request.geometry.frameOfReferenceUid);
    return null;
  } catch (error) {
    console.error(`${LOG_PREFIX} restoring ${request.measurementUid} failed`, error);
    return 'viewer-error';
  }
};

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

  const handleRestore = (command: RestoreMeasurementsCommand): void => {
    whenReady(() => {
      runRestore(services, channel, command);
    });
  };

  const dispose = (): void => {
    gates.forEach((subscription) => {
      subscription.unsubscribe();
    });
    gates.clear();
  };

  return { handleRestore, dispose };
};
