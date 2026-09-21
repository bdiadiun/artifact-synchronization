import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActivateToolCommand, RemoveMeasurementCommand } from '@bdiadiun/scoring-contract';

import { createCommandRegistry } from '../registry.js';

const activateTool: ActivateToolCommand = {
  version: 1,
  type: 'ACTIVATE_TOOL',
  requestId: 'req-1',
  rowId: 'row-1',
  toolName: 'EllipticalROI',
};

const removeMeasurement: RemoveMeasurementCommand = {
  version: 1,
  type: 'REMOVE_MEASUREMENT',
  requestId: 'req-2',
  rowId: 'row-1',
  measurementUid: 'uid-1',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCommandRegistry', () => {
  it('dispatches a command to the handler registered for its type', () => {
    const registry = createCommandRegistry();
    const handleActivate = vi.fn();
    registry.register('ACTIVATE_TOOL', handleActivate);

    registry.dispatch(activateTool);

    expect(handleActivate).toHaveBeenCalledTimes(1);
    expect(handleActivate).toHaveBeenCalledWith(activateTool);
  });

  it('routes a command only to the handler registered for its own type', () => {
    const registry = createCommandRegistry();
    const handleActivate = vi.fn();
    const handleRemove = vi.fn();
    registry.register('ACTIVATE_TOOL', handleActivate);
    registry.register('REMOVE_MEASUREMENT', handleRemove);

    registry.dispatch(removeMeasurement);

    expect(handleRemove).toHaveBeenCalledTimes(1);
    expect(handleActivate).not.toHaveBeenCalled();
  });

  it('ignores a command with no registered handler, without throwing', () => {
    const registry = createCommandRegistry();

    expect(() => {
      registry.dispatch(activateTool);
    }).not.toThrow();
  });

  it('replaces a handler registered a second time for the same type', () => {
    const registry = createCommandRegistry();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    registry.register('ACTIVATE_TOOL', firstHandler);
    registry.register('ACTIVATE_TOOL', secondHandler);
    registry.dispatch(activateTool);

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it('dispatching a type with no handler does nothing and does not throw', () => {
    const registry = createCommandRegistry();
    const handleRemove = vi.fn();
    registry.register('REMOVE_MEASUREMENT', handleRemove);

    expect(() => {
      registry.dispatch(activateTool);
    }).not.toThrow();
    expect(handleRemove).not.toHaveBeenCalled();
  });
});
