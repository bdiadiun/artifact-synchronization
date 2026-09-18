import { describe, expect, it } from 'vitest';
import { isHostCommand, type RestoreMeasurementRequest } from '@bdiadiun/scoring-contract';
import {
  activateToolCommand,
  deactivateToolCommand,
  focusMeasurementCommand,
  removeMeasurementCommand,
  restoreMeasurementsCommand,
} from '../commands';

describe('host command builders', () => {
  it('builds an ACTIVATE_TOOL command carrying the row tool', () => {
    const command = activateToolCommand('req-1', 'row-1', 'Length');

    expect(command).toEqual({
      version: 1,
      type: 'ACTIVATE_TOOL',
      requestId: 'req-1',
      rowId: 'row-1',
      toolName: 'Length',
    });
  });

  it('builds a DEACTIVATE_TOOL command', () => {
    expect(deactivateToolCommand('req-2', 'row-1')).toEqual({
      version: 1,
      type: 'DEACTIVATE_TOOL',
      requestId: 'req-2',
      rowId: 'row-1',
    });
  });

  it('builds a REMOVE_MEASUREMENT command with the caller-issued requestId', () => {
    expect(removeMeasurementCommand('req-3', 'row-1', 'uid-1')).toEqual({
      version: 1,
      type: 'REMOVE_MEASUREMENT',
      requestId: 'req-3',
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
  });

  it('builds a FOCUS_MEASUREMENT command', () => {
    expect(focusMeasurementCommand('req-4', 'row-1', 'uid-1')).toEqual({
      version: 1,
      type: 'FOCUS_MEASUREMENT',
      requestId: 'req-4',
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
  });

  it('builds a RESTORE_MEASUREMENTS command carrying the study and the row list', () => {
    const measurements: RestoreMeasurementRequest[] = [
      {
        rowId: 'row-1',
        measurementUid: 'uid-1',
        toolName: 'EllipticalROI',
        geometry: {
          frameOfReferenceUid: 'for-1',
          referencedImageId: 'image-1',
          points: [[1, 2, 3]],
        },
      },
    ];

    expect(restoreMeasurementsCommand('req-5', 'study-1', measurements)).toEqual({
      version: 1,
      type: 'RESTORE_MEASUREMENTS',
      requestId: 'req-5',
      studyInstanceUid: 'study-1',
      measurements,
    });
  });

  it('every builder produces a payload the contract guard accepts', () => {
    expect(isHostCommand(activateToolCommand('req-1', 'row-1', 'EllipticalROI'))).toBe(true);
    expect(isHostCommand(deactivateToolCommand('req-2', 'row-1'))).toBe(true);
    expect(isHostCommand(removeMeasurementCommand('req-3', 'row-1', 'uid-1'))).toBe(true);
    expect(isHostCommand(focusMeasurementCommand('req-4', 'row-1', 'uid-1'))).toBe(true);
    expect(
      isHostCommand(
        restoreMeasurementsCommand('req-5', 'study-1', [
          {
            rowId: 'row-1',
            measurementUid: 'uid-1',
            toolName: 'EllipticalROI',
            geometry: {
              frameOfReferenceUid: 'for-1',
              referencedImageId: 'image-1',
              points: [[1, 2, 3]],
            },
          },
        ]),
      ),
    ).toBe(true);
  });
});
