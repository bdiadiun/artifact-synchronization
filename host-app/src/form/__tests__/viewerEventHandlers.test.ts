// Direct coverage of createViewerEventHandlers; useScoringForm.test.tsx covers the same handlers
// wired through the reducer. Echo protection now lives in the channel's exchange (A-21): a message
// that reaches these handlers is by definition not an answer to a request this session made, so
// neither handler here still looks at `causedBy`.

import { describe, expect, it, vi } from 'vitest';
import type {
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
} from '@bdiadiun/scoring-contract';
import { createViewerEventHandlers, type ViewerEventContext } from '@app/form/viewerEventHandlers';
import { FormActionType, RowStatus, initialFormState } from '@app/form/rows';
import type { Row } from '@app/form/rows';

const doneRow: Row = {
  rowId: 'row-1',
  status: RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  measurementUid: 'uid-1',
  geometry: null,
  restoreFailureReason: null,
};

const buildContext = (
  rows: Row[] = [],
): { context: ViewerEventContext; dispatch: ReturnType<typeof vi.fn> } => {
  const dispatch = vi.fn();
  const context: ViewerEventContext = {
    state: { ...initialFormState, rows },
    dispatch,
    send: vi.fn(),
    exchange: vi.fn(),
    restoredRows: [],
  };
  return { context, dispatch };
};

describe('createViewerEventHandlers onMeasurementRemoved', () => {
  it('clears the done row whose measurementUid matches the event, regardless of causedBy', () => {
    const { context, dispatch } = buildContext([doneRow]);
    const handlers = createViewerEventHandlers(context);

    const event: MeasurementRemovedEvent = {
      version: 1,
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'uid-1',
      causedBy: 'some-request-id',
    };
    handlers.onMeasurementRemoved(event);

    expect(dispatch).toHaveBeenCalledWith({
      type: FormActionType.MeasurementCleared,
      rowId: 'row-1',
    });
  });

  it('dispatches nothing when the removed measurementUid matches no done row', () => {
    const { context, dispatch } = buildContext([]);
    const handlers = createViewerEventHandlers(context);

    const event: MeasurementRemovedEvent = {
      version: 1,
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'uid-unknown',
    };
    expect(() => {
      handlers.onMeasurementRemoved(event);
    }).not.toThrow();

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('createViewerEventHandlers onMeasurementsRestored', () => {
  it('logs every MEASUREMENTS_RESTORED reaching it as unmatched and dispatches nothing', () => {
    const { context, dispatch } = buildContext([]);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    const handlers = createViewerEventHandlers(context);

    const event: MeasurementsRestoredEvent = {
      version: 1,
      type: 'MEASUREMENTS_RESTORED',
      causedBy: 'req-9',
      restored: [],
      failed: [],
    };
    handlers.onMeasurementsRestored(event);

    expect(dispatch).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('unmatched'), 'req-9');

    debugSpy.mockRestore();
  });
});
