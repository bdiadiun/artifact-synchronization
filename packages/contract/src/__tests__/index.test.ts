import { describe, expect, it } from 'vitest';
import * as contract from '../index';

const publishedNames = [
  'ActivateToolCommand',
  'DeactivateToolCommand',
  'FocusMeasurementCommand',
  'HostCommand',
  'METRIC_KEY_BY_TOOL',
  'MeasurementAddedEvent',
  'MeasurementGeometry',
  'MeasurementRemovedEvent',
  'MeasurementUpdatedEvent',
  'MeasurementsRestoredEvent',
  'Metric',
  'MetricKey',
  'Metrics',
  'RemoveMeasurementCommand',
  'RestoreFailure',
  'RestoreFailureReason',
  'RestoreMeasurementRequest',
  'RestoreMeasurementsCommand',
  'ToolName',
  'Unit',
  'ViewerEvent',
  'ViewerReadyEvent',
  'isHostCommand',
  'isViewerEvent',
];

describe('package entry', () => {
  it('publishes exactly the schemas and guards its consumers import, and nothing else', () => {
    expect(Object.keys(contract).sort()).toEqual([...publishedNames].sort());
  });

  it('publishes both guards as functions', () => {
    expect(typeof contract.isHostCommand).toBe('function');
    expect(typeof contract.isViewerEvent).toBe('function');
  });

  it('publishes the metric key of every tool name', () => {
    expect(contract.METRIC_KEY_BY_TOOL).toEqual({
      EllipticalROI: 'area',
      RectangleROI: 'area',
      Length: 'length',
    });
  });
});
