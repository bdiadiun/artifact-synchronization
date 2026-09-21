import {
  hasVersion1,
  isMeasurementGeometry,
  isMetrics,
  isNonEmptyString,
  isOneOf,
  isOptionalString,
  isRecord,
} from './primitiveGuards';
import type { RestoreFailureReason, ViewerEvent } from './viewerEvents.props';

export const VIEWER_EVENT_TYPES = [
  'VIEWER_READY',
  'MEASUREMENT_ADDED',
  'MEASUREMENT_UPDATED',
  'MEASUREMENT_REMOVED',
  'MEASUREMENTS_RESTORED',
] as const;

const RESTORE_FAILURE_REASON_VALUES: readonly RestoreFailureReason[] = [
  'already-present',
  'unknown-study',
  'invalid-geometry',
  'viewer-error',
];

const isRestoreFailureReason = isOneOf(RESTORE_FAILURE_REASON_VALUES);

const isRestoreFailure = (value: unknown): boolean =>
  isRecord(value) && isNonEmptyString(value.rowId) && isRestoreFailureReason(value.reason);

// Plain booleans, not type predicates: interfaces without an index signature are not
// assignable to `Record<string, unknown>`, so a predicate here would not type-check.

const isViewerReadyEvent = (value: Record<string, unknown>): boolean =>
  value.type === 'VIEWER_READY' && typeof value.viewerVersion === 'string';

const isMeasurementAddedEvent = (value: Record<string, unknown>): boolean =>
  value.type === 'MEASUREMENT_ADDED' &&
  (value.rowId === null || isNonEmptyString(value.rowId)) &&
  isNonEmptyString(value.measurementUid) &&
  typeof value.toolName === 'string' &&
  isMetrics(value.metrics) &&
  isOptionalString(value.causedBy) &&
  (value.geometry === undefined || isMeasurementGeometry(value.geometry));

const isMeasurementUpdatedEvent = (value: Record<string, unknown>): boolean =>
  value.type === 'MEASUREMENT_UPDATED' &&
  isNonEmptyString(value.measurementUid) &&
  typeof value.toolName === 'string' &&
  isMetrics(value.metrics) &&
  isOptionalString(value.causedBy) &&
  (value.geometry === undefined || isMeasurementGeometry(value.geometry)) &&
  // null rowId means "unarmed" on ADDED only; reject it here rather than accept it silently.
  value.rowId !== null;

const isMeasurementRemovedEvent = (value: Record<string, unknown>): boolean =>
  value.type === 'MEASUREMENT_REMOVED' &&
  isNonEmptyString(value.measurementUid) &&
  isOptionalString(value.causedBy);

const isMeasurementsRestoredEvent = (value: Record<string, unknown>): boolean =>
  value.type === 'MEASUREMENTS_RESTORED' &&
  isOptionalString(value.causedBy) &&
  Array.isArray(value.restored) &&
  value.restored.every(isNonEmptyString) &&
  Array.isArray(value.failed) &&
  value.failed.every(isRestoreFailure);

export const isViewerEvent = (value: unknown): value is ViewerEvent => {
  if (!isRecord(value) || !hasVersion1(value)) {
    return false;
  }
  return (
    isViewerReadyEvent(value) ||
    isMeasurementAddedEvent(value) ||
    isMeasurementUpdatedEvent(value) ||
    isMeasurementRemovedEvent(value) ||
    isMeasurementsRestoredEvent(value)
  );
};
