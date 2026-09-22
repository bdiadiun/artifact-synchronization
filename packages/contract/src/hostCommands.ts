import type { HostCommand } from './hostCommands.props';
import {
  isMeasurementGeometry,
  isNonEmptyString,
  isOneOf,
  isRecord,
  isToolName,
} from './primitiveGuards';

export const HOST_COMMAND_TYPES: readonly HostCommand['type'][] = [
  'ACTIVATE_TOOL',
  'DEACTIVATE_TOOL',
  'REMOVE_MEASUREMENT',
  'FOCUS_MEASUREMENT',
  'RESTORE_MEASUREMENTS',
];

const isHostCommandType = isOneOf(HOST_COMMAND_TYPES);

const isActivateToolCommand = (value: Record<string, unknown>): boolean =>
  isNonEmptyString(value.requestId) && isNonEmptyString(value.rowId) && isToolName(value.toolName);

const isDeactivateToolCommand = (value: Record<string, unknown>): boolean =>
  isNonEmptyString(value.requestId) && isNonEmptyString(value.rowId);

const isMeasurementCommand = (value: Record<string, unknown>): boolean =>
  isNonEmptyString(value.requestId) &&
  isNonEmptyString(value.rowId) &&
  isNonEmptyString(value.measurementUid);

const isRestoreMeasurementRequest = (value: unknown): boolean =>
  isRecord(value) &&
  isNonEmptyString(value.rowId) &&
  isNonEmptyString(value.measurementUid) &&
  isToolName(value.toolName) &&
  isMeasurementGeometry(value.geometry);

const isRestoreMeasurementsCommand = (value: Record<string, unknown>): boolean =>
  isNonEmptyString(value.requestId) &&
  isNonEmptyString(value.studyInstanceUid) &&
  Array.isArray(value.measurements) &&
  value.measurements.every(isRestoreMeasurementRequest);

export const isHostCommand = (value: unknown): value is HostCommand => {
  if (!isRecord(value) || !isHostCommandType(value.type)) {
    return false;
  }

  switch (value.type) {
    case 'ACTIVATE_TOOL':
      return isActivateToolCommand(value);
    case 'DEACTIVATE_TOOL':
      return isDeactivateToolCommand(value);
    case 'REMOVE_MEASUREMENT':
    case 'FOCUS_MEASUREMENT':
      return isMeasurementCommand(value);
    case 'RESTORE_MEASUREMENTS':
      return isRestoreMeasurementsCommand(value);
    default:
      return false;
  }
};
