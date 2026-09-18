// Builders for the four host commands. The caller issues the `requestId` (A-8, A-10: it has to
// keep the id of a REMOVE_MEASUREMENT to recognise its own echo), this module only shapes the
// payload so the wire literals live in one place.

import type { HostCommand, RestoreMeasurementRequest, ToolName } from '@scoring/contract';

export const activateToolCommand = (
  requestId: string,
  rowId: string,
  toolName: ToolName,
): HostCommand => ({ version: 1, type: 'ACTIVATE_TOOL', requestId, rowId, toolName });

export const deactivateToolCommand = (requestId: string, rowId: string): HostCommand => ({
  version: 1,
  type: 'DEACTIVATE_TOOL',
  requestId,
  rowId,
});

export const removeMeasurementCommand = (
  requestId: string,
  rowId: string,
  measurementUid: string,
): HostCommand => ({ version: 1, type: 'REMOVE_MEASUREMENT', requestId, rowId, measurementUid });

export const focusMeasurementCommand = (
  requestId: string,
  rowId: string,
  measurementUid: string,
): HostCommand => ({ version: 1, type: 'FOCUS_MEASUREMENT', requestId, rowId, measurementUid });

export const restoreMeasurementsCommand = (
  requestId: string,
  studyInstanceUid: string,
  measurements: RestoreMeasurementRequest[],
): HostCommand => ({
  version: 1,
  type: 'RESTORE_MEASUREMENTS',
  requestId,
  studyInstanceUid,
  measurements,
});
