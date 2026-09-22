import { describe, expect, it } from 'vitest';
import {
  isViewerEvent,
  type MeasurementAddedEvent,
  type MeasurementRemovedEvent,
  type MeasurementsRestoredEvent,
  type MeasurementUpdatedEvent,
  type ViewerReadyEvent,
} from '../viewerEvents';
import type { ActivateToolCommand } from '../hostCommands';
import type { MeasurementGeometry } from '../vocabulary';

const activateTool: ActivateToolCommand = {
  type: 'ACTIVATE_TOOL',
  requestId: 'req-1',
  rowId: 'row-1',
  toolName: 'EllipticalROI',
};

const viewerReady: ViewerReadyEvent = {
  type: 'VIEWER_READY',
  viewerVersion: '3.12.17',
};

const measurementAdded: MeasurementAddedEvent = {
  type: 'MEASUREMENT_ADDED',
  rowId: 'row-1',
  measurementUid: 'uid-1',
  toolName: 'EllipticalROI',
  metrics: { area: { value: 12.5, unit: 'mm2' } },
};

const measurementUpdated: MeasurementUpdatedEvent = {
  type: 'MEASUREMENT_UPDATED',
  measurementUid: 'uid-1',
  toolName: 'EllipticalROI',
  metrics: { area: { value: 13.1, unit: 'mm2' } },
  causedBy: 'req-1',
};

const measurementRemoved: MeasurementRemovedEvent = {
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

const measurementsRestored: MeasurementsRestoredEvent = {
  type: 'MEASUREMENTS_RESTORED',
  causedBy: 'req-5',
  restored: ['uid-1'],
  failed: [{ rowId: 'row-2', reason: 'unknown-study' }],
};

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

  it('rejects a host command', () => {
    expect(isViewerEvent(activateTool)).toBe(false);
  });

  it('rejects an unknown type', () => {
    expect(isViewerEvent({ ...viewerReady, type: 'VIEWER_READY_X' })).toBe(false);
  });

  it('rejects a non-finite metric value', () => {
    expect(
      isViewerEvent({ ...measurementAdded, metrics: { area: { value: Infinity, unit: 'mm2' } } }),
    ).toBe(false);
  });

  it('rejects a metric under a key the vocabulary does not name', () => {
    expect(
      isViewerEvent({ ...measurementAdded, metrics: { mean: { value: 40, unit: 'mm' } } }),
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

  it('accepts the version key the channel stamps on the wire', () => {
    expect(isViewerEvent({ ...measurementAdded, version: 1 })).toBe(true);
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
