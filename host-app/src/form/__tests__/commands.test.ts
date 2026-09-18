import { describe, expect, it } from 'vitest';
import { isHostCommand } from '@scoring/contract';
import {
  activateToolCommand,
  deactivateToolCommand,
  focusMeasurementCommand,
  removeMeasurementCommand,
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

  it('every builder produces a payload the contract guard accepts', () => {
    expect(isHostCommand(activateToolCommand('req-1', 'row-1', 'EllipticalROI'))).toBe(true);
    expect(isHostCommand(deactivateToolCommand('req-2', 'row-1'))).toBe(true);
    expect(isHostCommand(removeMeasurementCommand('req-3', 'row-1', 'uid-1'))).toBe(true);
    expect(isHostCommand(focusMeasurementCommand('req-4', 'row-1', 'uid-1'))).toBe(true);
  });
});
