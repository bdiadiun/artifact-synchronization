import type { HostCommand } from './hostCommands.props';
import {
  hasVersion1,
  isMeasurementGeometry,
  isNonEmptyString,
  isRecord,
  isToolName,
} from './primitiveGuards';

// Plain booleans, not type predicates: interfaces without an index signature are not
// assignable to `Record<string, unknown>`, so a predicate here would not type-check.
type FieldsGuard = (value: Record<string, unknown>) => boolean;

const isRestoreMeasurementRequest = (value: unknown): boolean =>
  isRecord(value) &&
  isNonEmptyString(value.rowId) &&
  isNonEmptyString(value.measurementUid) &&
  isToolName(value.toolName) &&
  isMeasurementGeometry(value.geometry);

// One entry per command type: the `satisfies` clause fails the build when the contract gains a
// command and this table does not, and the type list below is the table's own keys.
const FIELDS_BY_TYPE = {
  ACTIVATE_TOOL: (value) =>
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.rowId) &&
    isToolName(value.toolName),

  DEACTIVATE_TOOL: (value) => isNonEmptyString(value.requestId) && isNonEmptyString(value.rowId),

  REMOVE_MEASUREMENT: (value) =>
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.rowId) &&
    isNonEmptyString(value.measurementUid),

  FOCUS_MEASUREMENT: (value) =>
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.rowId) &&
    isNonEmptyString(value.measurementUid),

  RESTORE_MEASUREMENTS: (value) =>
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.studyInstanceUid) &&
    Array.isArray(value.measurements) &&
    value.measurements.every(isRestoreMeasurementRequest),
} satisfies Record<HostCommand['type'], FieldsGuard>;

// `Object.keys` widens to `string`; the table above is what keeps these exactly the command types.
export const HOST_COMMAND_TYPES = Object.keys(FIELDS_BY_TYPE) as readonly HostCommand['type'][];

const isHostCommandType = (value: unknown): value is HostCommand['type'] =>
  typeof value === 'string' && Object.hasOwn(FIELDS_BY_TYPE, value);

export const isHostCommand = (value: unknown): value is HostCommand => {
  if (!isRecord(value) || !hasVersion1(value) || !isHostCommandType(value.type)) {
    return false;
  }
  return FIELDS_BY_TYPE[value.type](value);
};
