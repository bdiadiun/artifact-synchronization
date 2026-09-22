import {
  isMeasurementGeometry,
  type RestoreFailure,
  type RestoreFailureReason,
  type RestoreMeasurementRequest,
  type RestoreMeasurementsCommand,
} from '@bdiadiun/scoring-contract';
import { annotation } from '@cornerstonejs/tools';
import type { Annotation } from '@cornerstonejs/tools/types';
import { triggerAnnotationRenderForViewportIds } from '@cornerstonejs/tools/utilities';
import type { Types } from '@cornerstonejs/core';

import { LOG_PREFIX } from './config.js';
import type { OhifServicesManager } from './ohif.props.js';
import type { ReadinessGate, RestoreCommands, RestoreCommandsDeps } from './restore.props.js';

// A-14 / S-5.6. No value is posted from here: cornerstone recomputes cachedStats in the render
// pass this triggers and the existing MEASUREMENT_UPDATED path delivers it, which is why the
// uid -> rowId map is seeded before the annotation is added.

const failAll = (
  measurements: RestoreMeasurementRequest[],
  reason: RestoreFailureReason,
): RestoreFailure[] => measurements.map(({ rowId }) => ({ rowId, reason }));

// The contract guarantees three finite numbers per point (primitiveGuards.ts isPoints), which is
// cornerstone's world point; the geometry is checked before this runs.
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

// The viewport holds a cornerstone viewport only once its display set data has been set
// (CornerstoneViewportService.ts:509), the moment VIEWPORT_DATA_CHANGED reports (:492, :1229).
const createReadinessGate = (
  servicesManager: OhifServicesManager,
  getViewportId: () => string | undefined,
): ReadinessGate => {
  const { cornerstoneViewportService } = servicesManager.services;
  const gates = new Set<{ unsubscribe: () => void }>();

  const isReady = (): boolean => {
    const viewportId = getViewportId();
    return Boolean(viewportId && cornerstoneViewportService?.getCornerstoneViewport(viewportId));
  };

  return {
    whenReady: (run: () => void): void => {
      if (isReady() || !cornerstoneViewportService) {
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
    },

    dispose: (): void => {
      gates.forEach((subscription) => {
        subscription.unsubscribe();
      });
      gates.clear();
    },
  };
};

const createRowRestorer =
  ({ servicesManager, reported }: Omit<RestoreCommandsDeps, 'send'>) =>
  (request: RestoreMeasurementRequest): RestoreFailureReason | null => {
    if (servicesManager.services.measurementService?.getMeasurement(request.measurementUid)) {
      return 'already-present';
    }

    if (!isMeasurementGeometry(request.geometry)) {
      return 'invalid-geometry';
    }

    try {
      reported.bindRow(request.measurementUid, request.rowId);
      // The selector is only read when it is an enabled HTMLDivElement (annotationState.js:59-68);
      // for any string the group key comes from metadata.FrameOfReferenceUID (addSRAnnotation.ts:142).
      annotation.state.addAnnotation(toAnnotation(request), request.geometry.frameOfReferenceUid);
      return null;
    } catch (error) {
      console.error(`${LOG_PREFIX} restoring ${request.measurementUid} failed`, error);
      reported.forget(request.measurementUid);
      return 'viewer-error';
    }
  };

export const createRestoreCommands = (deps: RestoreCommandsDeps): RestoreCommands => {
  const { servicesManager, send } = deps;
  const { displaySetService, viewportGridService } = servicesManager.services;

  const activeViewportId = (): string | undefined => viewportGridService?.getActiveViewportId();
  const gate = createReadinessGate(servicesManager, activeViewportId);
  const restoreRow = createRowRestorer(deps);

  // The study the viewer shows is the one its loaded display sets belong to
  // (DisplaySetService.ts:114, getActiveDisplaySets).
  const showsStudy = (studyInstanceUid: string): boolean =>
    (displaySetService?.getActiveDisplaySets() ?? []).some(
      (displaySet) => displaySet.StudyInstanceUID === studyInstanceUid,
    );

  const runRestore = (command: RestoreMeasurementsCommand): void => {
    const restored: string[] = [];
    const failed: RestoreFailure[] = showsStudy(command.studyInstanceUid)
      ? []
      : failAll(command.measurements, 'unknown-study');

    if (failed.length === 0) {
      command.measurements.forEach((request) => {
        const reason = restoreRow(request);
        if (reason === null) {
          restored.push(request.rowId);
        } else {
          failed.push({ rowId: request.rowId, reason });
        }
      });
    }

    const viewportId = activeViewportId();

    if (restored.length > 0 && viewportId) {
      triggerAnnotationRenderForViewportIds([viewportId]);
    }

    const payload = { causedBy: command.requestId, restored, failed };

    if (send('MEASUREMENTS_RESTORED', payload)) {
      console.debug(`${LOG_PREFIX} MEASUREMENTS_RESTORED sent`, payload);
    }
  };

  return {
    handleRestore: (command: RestoreMeasurementsCommand): void => {
      gate.whenReady(() => {
        runRestore(command);
      });
    },

    dispose: gate.dispose,
  };
};
