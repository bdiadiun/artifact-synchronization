// Direct coverage of createViewerEventHandlers, the one function the channel hands every viewer
// event to (A-29); useScoringForm.test.tsx covers the same wiring through a real channel.

import { describe, expect, it, vi } from 'vitest';
import type {
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
} from '@bdiadiun/scoring-contract';
import { createViewerEventHandlers } from '@app/form/viewerEventHandlers';
import { FormActionType, RowStatus, initialFormState } from '@app/form/rows';
import type { FormContext } from '@app/form/rows';
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

const buildDeps = (
  rows: Row[] = [],
): { dispatch: ReturnType<typeof vi.fn>; getContext: () => FormContext } => {
  const dispatch = vi.fn();
  const context: FormContext = { state: { ...initialFormState, rows }, dispatch, channel: null };
  return { dispatch, getContext: () => context };
};

describe('createViewerEventHandlers MEASUREMENT_REMOVED', () => {
  it('clears the done row whose measurementUid matches the event', () => {
    const { dispatch, getContext } = buildDeps([doneRow]);
    const handleEvent = createViewerEventHandlers(getContext);

    const event: MeasurementRemovedEvent = {
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'uid-1',
    };
    handleEvent(event);

    expect(dispatch).toHaveBeenCalledWith({
      type: FormActionType.MeasurementCleared,
      measurementUid: 'uid-1',
    });
  });

  it('dispatches MeasurementCleared even for a measurementUid matching no row, leaving the reducer to ignore it', () => {
    const { dispatch, getContext } = buildDeps([]);
    const handleEvent = createViewerEventHandlers(getContext);

    const event: MeasurementRemovedEvent = {
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'uid-unknown',
    };
    handleEvent(event);

    expect(dispatch).toHaveBeenCalledWith({
      type: FormActionType.MeasurementCleared,
      measurementUid: 'uid-unknown',
    });
  });
});

describe('createViewerEventHandlers MEASUREMENT_UPDATED', () => {
  it('dispatches MeasurementUpdated with the event metrics, never sending anything back (Q-4)', () => {
    const { dispatch, getContext } = buildDeps([doneRow]);
    const handleEvent = createViewerEventHandlers(getContext);

    const event: MeasurementUpdatedEvent = {
      type: 'MEASUREMENT_UPDATED',
      measurementUid: 'uid-1',
      toolName: 'EllipticalROI',
      metrics: { area: { value: 200, unit: 'mm2' } },
    };
    handleEvent(event);

    expect(dispatch).toHaveBeenCalledWith({
      type: FormActionType.MeasurementUpdated,
      measurementUid: 'uid-1',
      metrics: event.metrics,
    });
  });
});

describe('createViewerEventHandlers MEASUREMENTS_RESTORED', () => {
  it('marks every row the viewer refused with the reason it gave', () => {
    const { dispatch, getContext } = buildDeps([doneRow]);
    const handleEvent = createViewerEventHandlers(getContext);

    const event: MeasurementsRestoredEvent = {
      type: 'MEASUREMENTS_RESTORED',
      restored: ['uid-1'],
      failed: [{ rowId: 'row-2', reason: 'invalid-geometry' }],
    };
    handleEvent(event);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: FormActionType.RestoreFailed,
      rowId: 'row-2',
      reason: 'invalid-geometry',
    });
  });
});

describe('createViewerEventHandlers MEASUREMENT_ADDED', () => {
  it('logs and dispatches nothing for a measurement drawn with no armed row (A-8)', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { dispatch, getContext } = buildDeps([]);
    const handleEvent = createViewerEventHandlers(getContext);

    handleEvent({
      type: 'MEASUREMENT_ADDED',
      rowId: null,
      measurementUid: 'uid-2',
      toolName: 'EllipticalROI',
      metrics: { area: { value: 1, unit: 'mm2' } },
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('ignored'), 'uid-2');

    infoSpy.mockRestore();
  });
});
