import {
  isMeasurementGeometry,
  isMetrics,
  isNonEmptyString,
  isOneOf,
  isOptionalString,
  isRecord,
} from './primitiveGuards';
import type { ViewerEvent } from './viewerEvents.props';

export const RESTORE_FAILURE_REASON_VALUES = [
  'already-present',
  'unknown-study',
  'invalid-geometry',
  'viewer-error',
] as const;

export const VIEWER_EVENT_TYPES: readonly ViewerEvent['type'][] = [
  'VIEWER_READY',
  'MEASUREMENT_ADDED',
  'MEASUREMENT_UPDATED',
  'MEASUREMENT_REMOVED',
  'MEASUREMENTS_RESTORED',
];

const isViewerEventType = isOneOf(VIEWER_EVENT_TYPES);

const isRestoreFailureReason = isOneOf(RESTORE_FAILURE_REASON_VALUES);

const isRestoreFailure = (value: unknown): boolean =>
  isRecord(value) && isNonEmptyString(value.rowId) && isRestoreFailureReason(value.reason);

const isViewerReadyEvent = (value: Record<string, unknown>): boolean =>
  typeof value.viewerVersion === 'string';

const hasMeasurementValue = (value: Record<string, unknown>): boolean =>
  isNonEmptyString(value.measurementUid) &&
  typeof value.toolName === 'string' &&
  isMetrics(value.metrics) &&
  isOptionalString(value.causedBy) &&
  (value.geometry === undefined || isMeasurementGeometry(value.geometry));

const isMeasurementAddedEvent = (value: Record<string, unknown>): boolean =>
  hasMeasurementValue(value) && (value.rowId === null || isNonEmptyString(value.rowId));

const isMeasurementUpdatedEvent = (value: Record<string, unknown>): boolean =>
  hasMeasurementValue(value) && value.rowId !== null;

const isMeasurementRemovedEvent = (value: Record<string, unknown>): boolean =>
  isNonEmptyString(value.measurementUid) && isOptionalString(value.causedBy);

const isMeasurementsRestoredEvent = (value: Record<string, unknown>): boolean =>
  isOptionalString(value.causedBy) &&
  Array.isArray(value.restored) &&
  value.restored.every(isNonEmptyString) &&
  Array.isArray(value.failed) &&
  value.failed.every(isRestoreFailure);

export const isViewerEvent = (value: unknown): value is ViewerEvent => {
  if (!isRecord(value) || !isViewerEventType(value.type)) {
    return false;
  }

  switch (value.type) {
    case 'VIEWER_READY':
      return isViewerReadyEvent(value);
    case 'MEASUREMENT_ADDED':
      return isMeasurementAddedEvent(value);
    case 'MEASUREMENT_UPDATED':
      return isMeasurementUpdatedEvent(value);
    case 'MEASUREMENT_REMOVED':
      return isMeasurementRemovedEvent(value);
    case 'MEASUREMENTS_RESTORED':
      return isMeasurementsRestoredEvent(value);
    default:
      return false;
  }
};
