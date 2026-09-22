import { describe, expect, it } from 'vitest';
import { isHostCommand } from '../hostCommands';
import type {
  ActivateToolCommand,
  DeactivateToolCommand,
  FocusMeasurementCommand,
  RemoveMeasurementCommand,
  RestoreMeasurementsCommand,
} from '../hostCommands.props';
import type { MeasurementGeometry } from '../vocabulary.props';
import type { ViewerReadyEvent } from '../viewerEvents.props';

const activateTool: ActivateToolCommand = {
  type: 'ACTIVATE_TOOL',
  requestId: 'req-1',
  rowId: 'row-1',
  toolName: 'EllipticalROI',
};

const deactivateTool: DeactivateToolCommand = {
  type: 'DEACTIVATE_TOOL',
  requestId: 'req-2',
  rowId: 'row-1',
};

const removeMeasurement: RemoveMeasurementCommand = {
  type: 'REMOVE_MEASUREMENT',
  requestId: 'req-3',
  rowId: 'row-1',
  measurementUid: 'uid-1',
};

const focusMeasurement: FocusMeasurementCommand = {
  type: 'FOCUS_MEASUREMENT',
  requestId: 'req-4',
  rowId: 'row-1',
  measurementUid: 'uid-1',
};

const geometry: MeasurementGeometry = {
  frameOfReferenceUid: 'for-1',
  referencedImageId: 'image-1',
  points: [
    [1, 2, 3],
    [4, 5, 6],
  ],
};

const restoreMeasurements: RestoreMeasurementsCommand = {
  type: 'RESTORE_MEASUREMENTS',
  requestId: 'req-5',
  studyInstanceUid: 'study-1',
  measurements: [{ rowId: 'row-1', measurementUid: 'uid-1', toolName: 'EllipticalROI', geometry }],
};

const viewerReady: ViewerReadyEvent = {
  type: 'VIEWER_READY',
  viewerVersion: '3.12.17',
};

describe('isHostCommand', () => {
  it('accepts a valid ACTIVATE_TOOL command', () => {
    expect(isHostCommand(activateTool)).toBe(true);
  });

  it('accepts a valid DEACTIVATE_TOOL command', () => {
    expect(isHostCommand(deactivateTool)).toBe(true);
  });

  it('rejects a viewer event', () => {
    expect(isHostCommand(viewerReady)).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(isHostCommand({ ...activateTool, type: 'ACTIVATE_TOOL_X' })).toBe(false);
  });

  it('rejects a command missing a required field', () => {
    const { rowId: _rowId, ...withoutRowId } = activateTool;
    expect(isHostCommand(withoutRowId)).toBe(false);
  });

  it('rejects a command with a wrong field type', () => {
    expect(isHostCommand({ ...activateTool, requestId: 42 })).toBe(false);
  });

  it('rejects an invalid tool name', () => {
    expect(isHostCommand({ ...activateTool, toolName: 'FreehandROI' })).toBe(false);
  });

  it('accepts an unknown extra field (forward compatibility)', () => {
    expect(isHostCommand({ ...activateTool, extra: 'ignored' })).toBe(true);
  });

  it('survives a JSON round-trip', () => {
    expect(isHostCommand(JSON.parse(JSON.stringify(activateTool)))).toBe(true);
  });

  it('accepts a valid REMOVE_MEASUREMENT command', () => {
    expect(isHostCommand(removeMeasurement)).toBe(true);
  });

  it('rejects REMOVE_MEASUREMENT missing measurementUid', () => {
    const { measurementUid: _measurementUid, ...withoutUid } = removeMeasurement;
    expect(isHostCommand(withoutUid)).toBe(false);
  });

  it('accepts a valid FOCUS_MEASUREMENT command', () => {
    expect(isHostCommand(focusMeasurement)).toBe(true);
  });

  it('rejects FOCUS_MEASUREMENT missing measurementUid', () => {
    const { measurementUid: _measurementUid, ...withoutUid } = focusMeasurement;
    expect(isHostCommand(withoutUid)).toBe(false);
  });

  it('accepts a valid RESTORE_MEASUREMENTS command', () => {
    expect(isHostCommand(restoreMeasurements)).toBe(true);
  });

  it('rejects RESTORE_MEASUREMENTS missing studyInstanceUid', () => {
    const { studyInstanceUid: _studyInstanceUid, ...withoutStudy } = restoreMeasurements;
    expect(isHostCommand(withoutStudy)).toBe(false);
  });

  it('rejects RESTORE_MEASUREMENTS with a non-array measurements field', () => {
    expect(isHostCommand({ ...restoreMeasurements, measurements: 'nope' })).toBe(false);
  });

  it('accepts RESTORE_MEASUREMENTS with an empty measurements array', () => {
    expect(isHostCommand({ ...restoreMeasurements, measurements: [] })).toBe(true);
  });

  it('rejects a restore request without geometry', () => {
    const { geometry: _geometry, ...requestWithoutGeometry } = restoreMeasurements.measurements[0];
    expect(isHostCommand({ ...restoreMeasurements, measurements: [requestWithoutGeometry] })).toBe(
      false,
    );
  });

  it('survives a JSON round-trip for RESTORE_MEASUREMENTS', () => {
    expect(isHostCommand(JSON.parse(JSON.stringify(restoreMeasurements)))).toBe(true);
  });
});
