import type { HostCommand } from './hostCommands.props';
import {
  hasVersion1,
  isMeasurementGeometry,
  isNonEmptyString,
  isRecord,
  isToolName,
} from './primitiveGuards';

export const HOST_COMMAND_TYPES = [
  'ACTIVATE_TOOL',
  'DEACTIVATE_TOOL',
  'REMOVE_MEASUREMENT',
  'FOCUS_MEASUREMENT',
  'RESTORE_MEASUREMENTS',
] as const;

// Plain booleans, not type predicates: interfaces without an index signature are not
// assignable to `Record<string, unknown>`, so a predicate here would not type-check.

const isRestoreMeasurementRequest = (value: unknown): boolean =>
  isRecord(value) &&
  isNonEmptyString(value.rowId) &&
  isNonEmptyString(value.measurementUid) &&
  isToolName(value.toolName) &&
  isMeasurementGeometry(value.geometry);

const isActivateToolCommand = (value: Record<string, unknown>): boolean =>
  value.type === 'ACTIVATE_TOOL' &&
  isNonEmptyString(value.requestId) &&
  isNonEmptyString(value.rowId) &&
  isToolName(value.toolName);

const isDeactivateToolCommand = (value: Record<string, unknown>): boolean =>
  value.type === 'DEACTIVATE_TOOL' &&
  isNonEmptyString(value.requestId) &&
  isNonEmptyString(value.rowId);

const isRemoveMeasurementCommand = (value: Record<string, unknown>): boolean =>
  value.type === 'REMOVE_MEASUREMENT' &&
  isNonEmptyString(value.requestId) &&
  isNonEmptyString(value.rowId) &&
  isNonEmptyString(value.measurementUid);

const isFocusMeasurementCommand = (value: Record<string, unknown>): boolean =>
  value.type === 'FOCUS_MEASUREMENT' &&
  isNonEmptyString(value.requestId) &&
  isNonEmptyString(value.rowId) &&
  isNonEmptyString(value.measurementUid);

const isRestoreMeasurementsCommand = (value: Record<string, unknown>): boolean =>
  value.type === 'RESTORE_MEASUREMENTS' &&
  isNonEmptyString(value.requestId) &&
  isNonEmptyString(value.studyInstanceUid) &&
  Array.isArray(value.measurements) &&
  value.measurements.every(isRestoreMeasurementRequest);

export const isHostCommand = (value: unknown): value is HostCommand => {
  if (!isRecord(value) || !hasVersion1(value)) {
    return false;
  }
  return (
    isActivateToolCommand(value) ||
    isDeactivateToolCommand(value) ||
    isRemoveMeasurementCommand(value) ||
    isFocusMeasurementCommand(value) ||
    isRestoreMeasurementsCommand(value)
  );
};
