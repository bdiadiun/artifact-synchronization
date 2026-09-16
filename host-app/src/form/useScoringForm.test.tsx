// Tests the React wiring around the row reducer (canon C-4.3.5, C-4.3.6, Q-6, decisions A-8,
// A-9): activation sends the right command, MEASUREMENT_ADDED moves an armed row to `done`, and
// stray/duplicate events are no-ops. The reducer's own rules are covered in rows.test.ts; these
// tests check that the hook decides correctly *when* to dispatch, not the reducer's outcome.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { MeasurementAddedEvent, MeasurementUpdatedEvent, ViewerEvent } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';
import { computeTotals } from './totals';
import { useScoringForm } from './useScoringForm';

afterEach(() => {
  cleanup();
});

function measurementAdded(rowId: string | null, overrides: Partial<MeasurementAddedEvent> = {}): MeasurementAddedEvent {
  return {
    version: 1,
    type: 'MEASUREMENT_ADDED',
    rowId,
    measurementUid: 'uid-1',
    toolName: 'EllipticalROI',
    metrics: { area: { value: 124.5, unit: 'mm2' } },
    ...overrides,
  };
}

function measurementUpdated(
  measurementUid: string,
  overrides: Partial<MeasurementUpdatedEvent> = {},
): MeasurementUpdatedEvent {
  return {
    version: 1,
    type: 'MEASUREMENT_UPDATED',
    measurementUid,
    toolName: 'EllipticalROI',
    metrics: { area: { value: 200, unit: 'mm2' } },
    ...overrides,
  };
}

describe('useScoringForm', () => {
  it('activate sends ACTIVATE_TOOL with the row id and the configured default tool', () => {
    const send = vi.fn();
    const { result } = renderHook(() => useScoringForm({ send, lastEvent: null }));

    act(() => result.current.addRow());
    const rowId = result.current.rows[0]!.rowId;

    act(() => result.current.activate(rowId));

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ACTIVATE_TOOL',
        rowId,
        toolName: DEFAULT_TOOL,
      }),
    );
  });

  it('a MEASUREMENT_ADDED for the armed row moves it to done with metrics', () => {
    const send = vi.fn();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => result.current.addRow());
    const rowId = result.current.rows[0]!.rowId;
    act(() => result.current.activate(rowId));

    const event = measurementAdded(rowId);
    act(() => rerender({ lastEvent: event }));

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe('done');
    expect(row?.metrics).toEqual(event.metrics);
    expect(row?.measurementUid).toBe('uid-1');
  });

  it('a MEASUREMENT_ADDED with rowId: null changes nothing', () => {
    const send = vi.fn();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => result.current.addRow());
    const rowId = result.current.rows[0]!.rowId;
    act(() => result.current.activate(rowId));

    const event = measurementAdded(null);
    act(() => rerender({ lastEvent: event }));

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe('drawing');
    expect(row?.metrics).toBeNull();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('ignored'), 'uid-1');

    infoSpy.mockRestore();
  });

  it('a MEASUREMENT_ADDED for a pending (not armed) row changes nothing', () => {
    const send = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => result.current.addRow());
    const rowId = result.current.rows[0]!.rowId;
    // Never activated: row stays `pending`.

    const event = measurementAdded(rowId);
    act(() => rerender({ lastEvent: event }));

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe('pending');
    expect(row?.metrics).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('the same event object re-rendered twice is processed once', () => {
    const send = vi.fn();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => result.current.addRow());
    const rowId = result.current.rows[0]!.rowId;
    act(() => result.current.activate(rowId));

    const event = measurementAdded(rowId);
    act(() => rerender({ lastEvent: event }));
    const rowAfterFirst = result.current.rows.find((r) => r.rowId === rowId);
    expect(rowAfterFirst?.status).toBe('done');

    // Same object reference, e.g. a re-render triggered by unrelated state: must be a no-op,
    // not a second MEASUREMENT_RECEIVED dispatch (which would be harmless here since the row is
    // already `done`, but the effect must not even attempt it).
    act(() => rerender({ lastEvent: event }));
    const rowAfterSecond = result.current.rows.find((r) => r.rowId === rowId);
    expect(rowAfterSecond).toBe(rowAfterFirst);
  });

  it('MEASUREMENT_UPDATED for a done row changes the displayed metrics and the totals input', () => {
    const send = vi.fn();
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => result.current.addRow());
    const rowId = result.current.rows[0]!.rowId;
    act(() => result.current.activate(rowId));
    act(() => rerender({ lastEvent: measurementAdded(rowId) }));

    expect(computeTotals(result.current.rows)).toEqual([{ unit: 'mm2', value: 124.5, count: 1 }]);

    const updated = measurementUpdated('uid-1', { metrics: { area: { value: 200, unit: 'mm2' } } });
    act(() => rerender({ lastEvent: updated }));

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.metrics).toEqual(updated.metrics);
    expect(computeTotals(result.current.rows)).toEqual([{ unit: 'mm2', value: 200, count: 1 }]);
  });

  it('MEASUREMENT_UPDATED never triggers send (Q-4: no echo loop on the host side)', () => {
    const send = vi.fn();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { result, rerender } = renderHook(
      ({ lastEvent }: { lastEvent: ViewerEvent | null }) => useScoringForm({ send, lastEvent }),
      { initialProps: { lastEvent: null as ViewerEvent | null } },
    );

    act(() => result.current.addRow());
    const rowId = result.current.rows[0]!.rowId;
    act(() => result.current.activate(rowId));
    act(() => rerender({ lastEvent: measurementAdded(rowId) }));
    send.mockClear();

    act(() => rerender({ lastEvent: measurementUpdated('uid-1') }));
    expect(send).not.toHaveBeenCalled();

    // Also verify the "unknown uid" path, expected for measurements drawn without arming: still
    // no send, and it logs via `console.debug`, not `console.warn`.
    act(() => rerender({ lastEvent: measurementUpdated('ghost-uid') }));
    expect(send).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
  });
});
