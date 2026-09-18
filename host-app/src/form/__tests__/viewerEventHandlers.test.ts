// Direct coverage of createViewerEventHandlers; useScoringForm.test.tsx covers the same handlers
// wired through the reducer, this file targets the echo bookkeeping in isolation.

import { describe, expect, it, vi } from 'vitest';
import type { MeasurementRemovedEvent } from '@scoring/contract';
import { createViewerEventHandlers, type ViewerEventContext } from '../viewerEventHandlers';
import { initialFormState } from '../rows';

const buildContext = (
  issuedRemovalRequestIds: Set<string>,
): { context: ViewerEventContext; dispatch: ReturnType<typeof vi.fn> } => {
  const dispatch = vi.fn();
  const context: ViewerEventContext = {
    state: initialFormState,
    dispatch,
    send: vi.fn(),
    issuedRemovalRequestIds,
    restoredRows: [],
    issuedRestoreRequestIds: new Set(),
  };
  return { context, dispatch };
};

describe('createViewerEventHandlers onMeasurementRemoved', () => {
  it('a REMOVE_MEASUREMENT echo for an uid matching no row clears the causedBy entry and dispatches nothing', () => {
    const issuedRemovalRequestIds = new Set(['req-1']);
    const { context, dispatch } = buildContext(issuedRemovalRequestIds);
    const handlers = createViewerEventHandlers(context);

    const event: MeasurementRemovedEvent = {
      version: 1,
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'uid-unknown',
      causedBy: 'req-1',
    };

    expect(() => {
      handlers.onMeasurementRemoved(event);
    }).not.toThrow();

    expect(dispatch).not.toHaveBeenCalled();
    expect(issuedRemovalRequestIds.has('req-1')).toBe(false);
  });
});
