// Tests the React wiring around the row reducer: when the hook decides to dispatch, not the
// reducer's outcome (covered in rows.test.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type {
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementUpdatedEvent,
  ViewerEvent,
} from '@scoring/contract';
import { DEFAULT_TOOL } from '../../config';
import { RowStatus } from '../rows';
import { computeTotals } from '../totals';
import { useScoringForm } from '../useScoringForm';

afterEach(() => {
  cleanup();
});

// Typed mock so `send.mock.calls` narrows to `HostCommand` instead of `any` (no-unsafe-member-access).
const createSend = (): ReturnType<typeof vi.fn<(command: HostCommand) => void>> => vi.fn();

const measurementAdded = (
  rowId: string | null,
  overrides: Partial<MeasurementAddedEvent> = {},
): MeasurementAddedEvent => ({
  version: 1,
  type: 'MEASUREMENT_ADDED',
  rowId,
  measurementUid: 'uid-1',
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  ...overrides,
});

const measurementUpdated = (
  measurementUid: string,
  overrides: Partial<MeasurementUpdatedEvent> = {},
): MeasurementUpdatedEvent => ({
  version: 1,
  type: 'MEASUREMENT_UPDATED',
  measurementUid,
  toolName: 'EllipticalROI',
  metrics: { area: { value: 200, unit: 'mm2' } },
  ...overrides,
});

const measurementRemoved = (
  measurementUid: string,
  overrides: Partial<MeasurementRemovedEvent> = {},
): MeasurementRemovedEvent => ({
  version: 1,
  type: 'MEASUREMENT_REMOVED',
  measurementUid,
  ...overrides,
});

describe('useScoringForm', () => {
  it('activate sends ACTIVATE_TOOL with the row id and the configured default tool', () => {
    const send = createSend();
    const { result } = renderHook(() => useScoringForm({ send, lastEvent: null }));

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;

    act(() => {
      result.current.activate(rowId);
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ACTIVATE_TOOL',
        rowId,
        toolName: DEFAULT_TOOL,
      }),
    );
  });

  it('a MEASUREMENT_ADDED for the armed row moves it to done with metrics', () => {
    const send = createSend();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    const event = measurementAdded(rowId);
    act(() => {
      rerender({ lastEvent: event });
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Done);
    expect(row?.metrics).toEqual(event.metrics);
    expect(row?.measurementUid).toBe('uid-1');
  });

  it('a MEASUREMENT_ADDED with rowId: null changes nothing', () => {
    const send = createSend();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(vi.fn());
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    const event = measurementAdded(null);
    act(() => {
      rerender({ lastEvent: event });
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Drawing);
    expect(row?.metrics).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('ignored'), 'uid-1');

    infoSpy.mockRestore();
  });

  it('a MEASUREMENT_ADDED for a pending (not armed) row changes nothing', () => {
    const send = createSend();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    // Never activated: row stays `pending`.

    const event = measurementAdded(rowId);
    act(() => {
      rerender({ lastEvent: event });
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Pending);
    expect(row?.metrics).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('the same event object re-rendered twice is processed once', () => {
    const send = createSend();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    const event = measurementAdded(rowId);
    act(() => {
      rerender({ lastEvent: event });
    });
    const rowAfterFirst = result.current.rows.find((r) => r.rowId === rowId);
    expect(rowAfterFirst?.status).toBe(RowStatus.Done);

    // Same object reference, e.g. a re-render triggered by unrelated state: must be a no-op,
    // not a second MEASUREMENT_RECEIVED dispatch (which would be harmless here since the row is
    // already `done`, but the effect must not even attempt it).
    act(() => {
      rerender({ lastEvent: event });
    });
    const rowAfterSecond = result.current.rows.find((r) => r.rowId === rowId);
    expect(rowAfterSecond).toBe(rowAfterFirst);
  });

  it('MEASUREMENT_UPDATED for a done row changes the displayed metrics and the totals input', () => {
    const send = createSend();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    act(() => {
      rerender({ lastEvent: measurementAdded(rowId) });
    });

    expect(computeTotals(result.current.rows)).toEqual([{ unit: 'mm2', value: 124.5, count: 1 }]);

    const updated = measurementUpdated('uid-1', { metrics: { area: { value: 200, unit: 'mm2' } } });
    act(() => {
      rerender({ lastEvent: updated });
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.metrics).toEqual(updated.metrics);
    expect(computeTotals(result.current.rows)).toEqual([{ unit: 'mm2', value: 200, count: 1 }]);
  });

  it('MEASUREMENT_UPDATED never triggers send (Q-4: no echo loop on the host side)', () => {
    const send = createSend();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    act(() => {
      rerender({ lastEvent: measurementAdded(rowId) });
    });
    send.mockClear();

    act(() => {
      rerender({ lastEvent: measurementUpdated('uid-1') });
    });
    expect(send).not.toHaveBeenCalled();

    // Also verify the "unknown uid" path, expected for measurements drawn without arming: still
    // no send, and it logs via `console.debug`, not `console.warn`.
    act(() => {
      rerender({ lastEvent: measurementUpdated('ghost-uid') });
    });
    expect(send).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
  });

  it('remove on a done row sends REMOVE_MEASUREMENT and drops the row', () => {
    const send = createSend();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    act(() => {
      rerender({ lastEvent: measurementAdded(rowId) });
    });

    act(() => {
      result.current.remove(rowId);
    });

    expect(result.current.rows).toHaveLength(0);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REMOVE_MEASUREMENT', rowId, measurementUid: 'uid-1' }),
    );
  });

  it('the echo of our own REMOVE_MEASUREMENT (causedBy matches) is ignored, not reapplied', () => {
    const send = createSend();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    act(() => {
      rerender({ lastEvent: measurementAdded(rowId) });
    });

    act(() => {
      result.current.remove(rowId);
    });
    const removeCall = send.mock.calls.find((call) => call[0].type === 'REMOVE_MEASUREMENT');
    const requestId = removeCall?.[0].requestId ?? '';
    send.mockClear();

    const rowsBefore = result.current.rows;
    act(() => {
      rerender({ lastEvent: measurementRemoved('uid-1', { causedBy: requestId }) });
    });

    expect(result.current.rows).toBe(rowsBefore);
    expect(send).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
  });

  it('a viewer-originated MEASUREMENT_REMOVED clears the done row to pending and never calls send', () => {
    const send = createSend();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    act(() => {
      rerender({ lastEvent: measurementAdded(rowId) });
    });
    send.mockClear();

    act(() => {
      rerender({ lastEvent: measurementRemoved('uid-1') });
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row).toMatchObject({ status: RowStatus.Pending, metrics: null, measurementUid: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('focus on a done row sends FOCUS_MEASUREMENT with its measurementUid', () => {
    const send = createSend();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    act(() => {
      rerender({ lastEvent: measurementAdded(rowId) });
    });
    send.mockClear();

    act(() => {
      result.current.focus(rowId);
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FOCUS_MEASUREMENT', rowId, measurementUid: 'uid-1' }),
    );
  });

  it('focus on a pending row sends nothing', () => {
    const send = createSend();
    const { result } = renderHook(() => useScoringForm({ send, lastEvent: null }));

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;

    act(() => {
      result.current.focus(rowId);
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('remove on a drawing row sends DEACTIVATE_TOOL then drops the row', () => {
    const send = createSend();
    const { result } = renderHook(() => useScoringForm({ send, lastEvent: null }));

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    send.mockClear();

    act(() => {
      result.current.remove(rowId);
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId }));
    expect(result.current.rows).toHaveLength(0);
  });
});
