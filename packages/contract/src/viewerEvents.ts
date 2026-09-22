import {
  hasVersion1,
  isMeasurementGeometry,
  isMetrics,
  isNonEmptyString,
  isOneOf,
  isOptionalString,
  isRecord,
} from './primitiveGuards';
import type { ViewerEvent } from './viewerEvents.props';

// Written once, as the tuple the guard tests against; `viewerEvents.props.ts` derives the reason
// union from it.
export const RESTORE_FAILURE_REASON_VALUES = [
  'already-present',
  'unknown-study',
  'invalid-geometry',
  'viewer-error',
] as const;

// Plain booleans, not type predicates: interfaces without an index signature are not
// assignable to `Record<string, unknown>`, so a predicate here would not type-check.
type FieldsGuard = (value: Record<string, unknown>) => boolean;

const isRestoreFailureReason = isOneOf(RESTORE_FAILURE_REASON_VALUES);

const isRestoreFailure = (value: unknown): boolean =>
  isRecord(value) && isNonEmptyString(value.rowId) && isRestoreFailureReason(value.reason);

// One entry per event type: the `satisfies` clause fails the build when the contract gains an
// event and this table does not, and the type list below is the table's own keys.
const FIELDS_BY_TYPE = {
  VIEWER_READY: (value) => typeof value.viewerVersion === 'string',

  MEASUREMENT_ADDED: (value) =>
    (value.rowId === null || isNonEmptyString(value.rowId)) &&
    isNonEmptyString(value.measurementUid) &&
    typeof value.toolName === 'string' &&
    isMetrics(value.metrics) &&
    isOptionalString(value.causedBy) &&
    (value.geometry === undefined || isMeasurementGeometry(value.geometry)),

  MEASUREMENT_UPDATED: (value) =>
    isNonEmptyString(value.measurementUid) &&
    typeof value.toolName === 'string' &&
    isMetrics(value.metrics) &&
    isOptionalString(value.causedBy) &&
    (value.geometry === undefined || isMeasurementGeometry(value.geometry)) &&
    // null rowId means "unarmed" on ADDED only; reject it here rather than accept it silently.
    value.rowId !== null,

  MEASUREMENT_REMOVED: (value) =>
    isNonEmptyString(value.measurementUid) && isOptionalString(value.causedBy),

  MEASUREMENTS_RESTORED: (value) =>
    isOptionalString(value.causedBy) &&
    Array.isArray(value.restored) &&
    value.restored.every(isNonEmptyString) &&
    Array.isArray(value.failed) &&
    value.failed.every(isRestoreFailure),
} satisfies Record<ViewerEvent['type'], FieldsGuard>;

// `Object.keys` widens to `string`; the table above is what keeps these exactly the event types.
export const VIEWER_EVENT_TYPES = Object.keys(FIELDS_BY_TYPE) as readonly ViewerEvent['type'][];

const isViewerEventType = (value: unknown): value is ViewerEvent['type'] =>
  typeof value === 'string' && Object.hasOwn(FIELDS_BY_TYPE, value);

export const isViewerEvent = (value: unknown): value is ViewerEvent => {
  if (!isRecord(value) || !hasVersion1(value) || !isViewerEventType(value.type)) {
    return false;
  }
  return FIELDS_BY_TYPE[value.type](value);
};
