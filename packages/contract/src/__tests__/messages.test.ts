import { describe, expect, it } from 'vitest';
import {
  isHostCommand,
  isViewerEvent,
  METRIC_KEY_BY_TOOL,
  TOOL_NAME_VALUES,
  type ActivateToolCommand,
  type DeactivateToolCommand,
  type FocusMeasurementCommand,
  type MeasurementAddedEvent,
  type MeasurementGeometry,
  type MeasurementRemovedEvent,
  type MeasurementsRestoredEvent,
  type MeasurementUpdatedEvent,
  type MetricKey,
  type RemoveMeasurementCommand,
  type RestoreMeasurementsCommand,
  type ViewerReadyEvent,
} from '../messages';

const activateTool: ActivateToolCommand = {
  version: 1,
  type: 'ACTIVATE_TOOL',
  requestId: 'req-1',
  rowId: 'row-1',
  toolName: 'EllipticalROI',
};

const deactivateTool: DeactivateToolCommand = {
  version: 1,
  type: 'DEACTIVATE_TOOL',
  requestId: 'req-2',
  rowId: 'row-1',
};

const viewerReady: ViewerReadyEvent = {
  version: 1,
  type: 'VIEWER_READY',
  viewerVersion: '3.12.17',
};

const measurementAdded: MeasurementAddedEvent = {
  version: 1,
  type: 'MEASUREMENT_ADDED',
  rowId: 'row-1',
  measurementUid: 'uid-1',
  toolName: 'EllipticalROI',
  metrics: { area: { value: 12.5, unit: 'mm2' } },
};

const measurementUpdated: MeasurementUpdatedEvent = {
  version: 1,
  type: 'MEASUREMENT_UPDATED',
  measurementUid: 'uid-1',
  toolName: 'EllipticalROI',
  metrics: { area: { value: 13.1, unit: 'mm2' } },
  causedBy: 'req-1',
};

const removeMeasurement: RemoveMeasurementCommand = {
  version: 1,
  type: 'REMOVE_MEASUREMENT',
  requestId: 'req-3',
  rowId: 'row-1',
  measurementUid: 'uid-1',
};

const focusMeasurement: FocusMeasurementCommand = {
  version: 1,
  type: 'FOCUS_MEASUREMENT',
  requestId: 'req-4',
  rowId: 'row-1',
  measurementUid: 'uid-1',
};

const measurementRemoved: MeasurementRemovedEvent = {
  version: 1,
  type: 'MEASUREMENT_REMOVED',
  measurementUid: 'uid-1',
  causedBy: 'req-3',
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
  version: 1,
  type: 'RESTORE_MEASUREMENTS',
  requestId: 'req-5',
  studyInstanceUid: 'study-1',
  measurements: [{ rowId: 'row-1', measurementUid: 'uid-1', toolName: 'EllipticalROI', geometry }],
};

const measurementsRestored: MeasurementsRestoredEvent = {
  version: 1,
  type: 'MEASUREMENTS_RESTORED',
  causedBy: 'req-5',
  restored: ['uid-1'],
  failed: [{ rowId: 'row-2', reason: 'unknown-study' }],
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

  it('rejects the wrong contract version', () => {
    expect(isHostCommand({ ...activateTool, version: 2 })).toBe(false);
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

  it('rejects geometry with a non-finite point value', () => {
    const badGeometry = { ...geometry, points: [[1, Infinity, 3]] };
    expect(
      isHostCommand({
        ...restoreMeasurements,
        measurements: [{ ...restoreMeasurements.measurements[0], geometry: badGeometry }],
      }),
    ).toBe(false);
  });

  it('rejects geometry with an empty points array', () => {
    const badGeometry = { ...geometry, points: [] };
    expect(
      isHostCommand({
        ...restoreMeasurements,
        measurements: [{ ...restoreMeasurements.measurements[0], geometry: badGeometry }],
      }),
    ).toBe(false);
  });

  it('rejects geometry with a two-coordinate point', () => {
    const badGeometry = { ...geometry, points: [[1, 2]] };
    expect(
      isHostCommand({
        ...restoreMeasurements,
        measurements: [{ ...restoreMeasurements.measurements[0], geometry: badGeometry }],
      }),
    ).toBe(false);
  });

  it('rejects geometry with a four-coordinate point', () => {
    const badGeometry = { ...geometry, points: [[1, 2, 3, 4]] };
    expect(
      isHostCommand({
        ...restoreMeasurements,
        measurements: [{ ...restoreMeasurements.measurements[0], geometry: badGeometry }],
      }),
    ).toBe(false);
  });

  it('accepts geometry with a three-coordinate point', () => {
    const goodGeometry = { ...geometry, points: [[1, 2, 3]] };
    expect(
      isHostCommand({
        ...restoreMeasurements,
        measurements: [{ ...restoreMeasurements.measurements[0], geometry: goodGeometry }],
      }),
    ).toBe(true);
  });

  it('survives a JSON round-trip for RESTORE_MEASUREMENTS', () => {
    expect(isHostCommand(JSON.parse(JSON.stringify(restoreMeasurements)))).toBe(true);
  });
});

describe('isViewerEvent', () => {
  it('accepts a valid VIEWER_READY event', () => {
    expect(isViewerEvent(viewerReady)).toBe(true);
  });

  it('accepts a valid MEASUREMENT_ADDED event', () => {
    expect(isViewerEvent(measurementAdded)).toBe(true);
  });

  it('accepts a valid MEASUREMENT_UPDATED event', () => {
    expect(isViewerEvent(measurementUpdated)).toBe(true);
  });

  it('accepts MEASUREMENT_ADDED with a null rowId', () => {
    expect(isViewerEvent({ ...measurementAdded, rowId: null })).toBe(true);
  });

  it('rejects MEASUREMENT_UPDATED with a null rowId (rowId does not exist on this event)', () => {
    expect(isViewerEvent({ ...measurementUpdated, rowId: null })).toBe(false);
  });

  it('rejects a host command', () => {
    expect(isViewerEvent(activateTool)).toBe(false);
  });

  it('rejects the wrong contract version', () => {
    expect(isViewerEvent({ ...viewerReady, version: 0 })).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(isViewerEvent({ ...viewerReady, type: 'VIEWER_READY_X' })).toBe(false);
  });

  it('rejects a non-finite metric value', () => {
    expect(
      isViewerEvent({ ...measurementAdded, metrics: { area: { value: Infinity, unit: 'mm2' } } }),
    ).toBe(false);
  });

  it('rejects a bad unit', () => {
    expect(
      isViewerEvent({ ...measurementAdded, metrics: { area: { value: 1, unit: 'cm2' } } }),
    ).toBe(false);
  });

  it('rejects a missing required field', () => {
    const { measurementUid: _measurementUid, ...withoutUid } = measurementAdded;
    expect(isViewerEvent(withoutUid)).toBe(false);
  });

  it('accepts an unknown extra field (forward compatibility)', () => {
    expect(isViewerEvent({ ...measurementAdded, extra: 'ignored' })).toBe(true);
  });

  it('survives a JSON round-trip', () => {
    expect(isViewerEvent(JSON.parse(JSON.stringify(measurementAdded)))).toBe(true);
  });

  it('accepts a valid MEASUREMENT_REMOVED event with causedBy', () => {
    expect(isViewerEvent(measurementRemoved)).toBe(true);
  });

  it('accepts a valid MEASUREMENT_REMOVED event without causedBy', () => {
    const { causedBy: _causedBy, ...withoutCausedBy } = measurementRemoved;
    expect(isViewerEvent(withoutCausedBy)).toBe(true);
  });

  it('rejects MEASUREMENT_REMOVED with a wrong-type causedBy', () => {
    expect(isViewerEvent({ ...measurementRemoved, causedBy: 42 })).toBe(false);
  });

  it('accepts MEASUREMENT_ADDED with geometry', () => {
    expect(isViewerEvent({ ...measurementAdded, geometry })).toBe(true);
  });

  it('accepts MEASUREMENT_ADDED without geometry', () => {
    expect(isViewerEvent(measurementAdded)).toBe(true);
  });

  it('rejects MEASUREMENT_UPDATED with invalid geometry', () => {
    expect(isViewerEvent({ ...measurementUpdated, geometry: { ...geometry, points: [] } })).toBe(
      false,
    );
  });

  it('accepts a valid MEASUREMENTS_RESTORED event with causedBy', () => {
    expect(isViewerEvent(measurementsRestored)).toBe(true);
  });

  it('accepts a valid MEASUREMENTS_RESTORED event without causedBy', () => {
    const { causedBy: _causedBy, ...withoutCausedBy } = measurementsRestored;
    expect(isViewerEvent(withoutCausedBy)).toBe(true);
  });

  it('rejects MEASUREMENTS_RESTORED with an unknown failure reason', () => {
    expect(
      isViewerEvent({
        ...measurementsRestored,
        failed: [{ rowId: 'row-2', reason: 'gremlins' }],
      }),
    ).toBe(false);
  });

  it('survives a JSON round-trip for MEASUREMENTS_RESTORED', () => {
    expect(isViewerEvent(JSON.parse(JSON.stringify(measurementsRestored)))).toBe(true);
  });
});

describe('METRIC_KEY_BY_TOOL', () => {
  // A Record keyed by every ToolName: a tool added to TOOL_NAME_VALUES without an entry here
  // fails to compile, and a wrong entry fails the assertion below.
  const expectedMetricKeyByTool: Record<(typeof TOOL_NAME_VALUES)[number], MetricKey> = {
    EllipticalROI: 'area',
    RectangleROI: 'area',
    Length: 'length',
  };

  it.each(TOOL_NAME_VALUES)('maps %s to its metric key', (toolName) => {
    expect(METRIC_KEY_BY_TOOL[toolName]).toBe(expectedMetricKeyByTool[toolName]);
  });
});
