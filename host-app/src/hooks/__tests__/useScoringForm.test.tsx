// Tests the React wiring around the row reducer: when the hook decides to dispatch, not the
// reducer's outcome (covered in rows.test.ts). Outgoing traffic goes through the channel's `send`
// and `exchange` (A-21); a request/answer pair (REMOVE_MEASUREMENT, RESTORE_MEASUREMENTS) is
// exercised through `exchange`, everything else through `send`.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type {
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  ViewerEvent,
  ViewerReadyEvent,
} from '@bdiadiun/scoring-contract';
import type { HostChannel } from '@bdiadiun/scoring-orchestrator';
import { DEFAULT_TOOL, FALLBACK_STUDY_INSTANCE_UID } from '@app/config';
import { RowStatus, type Row } from '@app/form/rows';
import { saveRows } from '@app/form/storage';
import { computeTotals } from '@app/form/totals';
import { useScoringForm } from '@app/hooks/useScoringForm';

afterEach(() => {
  cleanup();
});

// Loosely typed mocks, cast to the channel's generic signature: a test double stands in for
// whichever `type`/`payload` pair the code under test happens to send.
const createSend = (): HostChannel['send'] => vi.fn(() => true);

// A pending promise that never settles: the default for a test that never resolves the exchange.
const neverAnswers = (): Promise<unknown> => new Promise<unknown>(() => undefined);

const createExchange = (impl?: (...args: unknown[]) => Promise<unknown>): HostChannel['exchange'] =>
  vi.fn(impl ?? neverAnswers) as unknown as HostChannel['exchange'];

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

const viewerReady = (viewerVersion = '1.0.0'): ViewerReadyEvent => ({
  version: 1,
  type: 'VIEWER_READY',
  viewerVersion,
});

const measurementsRestored = (
  overrides: Partial<MeasurementsRestoredEvent> = {},
): MeasurementsRestoredEvent => ({
  version: 1,
  type: 'MEASUREMENTS_RESTORED',
  restored: [],
  failed: [],
  ...overrides,
});

const storedRow = (rowId: string, measurementUid: string): Row => ({
  rowId,
  status: RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  measurementUid,
  geometry: { frameOfReferenceUid: 'for-1', referencedImageId: 'image-1', points: [[1, 2, 3]] },
  restoreFailureReason: null,
});

const renderForm = (
  send: HostChannel['send'],
  exchange: HostChannel['exchange'],
  initialLastEvent: ViewerEvent | null = null,
) =>
  renderHook(
    ({ lastEvent }: { lastEvent: ViewerEvent | null }) =>
      useScoringForm({ send, exchange, lastEvent }),
    { initialProps: { lastEvent: initialLastEvent } },
  );

describe('useScoringForm', () => {
  it('activate sends ACTIVATE_TOOL with the row id and the configured default tool', () => {
    const send = createSend();
    const { result } = renderForm(send, createExchange());

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;

    act(() => {
      result.current.activate(rowId);
    });

    expect(send).toHaveBeenCalledWith(
      'ACTIVATE_TOOL',
      expect.objectContaining({ rowId, toolName: DEFAULT_TOOL }),
    );
  });

  it('activate sends the length tool for a row added as a length row', () => {
    const send = createSend();
    const { result } = renderForm(send, createExchange());

    act(() => {
      result.current.addRow('Length');
    });
    const rowId = result.current.rows[0].rowId;

    act(() => {
      result.current.activate(rowId);
    });

    expect(send).toHaveBeenCalledWith(
      'ACTIVATE_TOOL',
      expect.objectContaining({ rowId, toolName: 'Length' }),
    );
  });

  it('addRow with no argument still uses the configured area tool', () => {
    const { result } = renderForm(createSend(), createExchange());

    act(() => {
      result.current.addRow();
    });

    expect(result.current.rows[0].toolName).toBe(DEFAULT_TOOL);
  });

  it('a MEASUREMENT_ADDED for the armed row moves it to done with metrics', () => {
    const { result, rerender } = renderForm(createSend(), createExchange());

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
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(vi.fn());
    const { result, rerender } = renderForm(createSend(), createExchange());

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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    const { result, rerender } = renderForm(createSend(), createExchange());

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
    const { result, rerender } = renderForm(createSend(), createExchange());

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

    act(() => {
      rerender({ lastEvent: event });
    });
    const rowAfterSecond = result.current.rows.find((r) => r.rowId === rowId);
    expect(rowAfterSecond).toBe(rowAfterFirst);
  });

  it('MEASUREMENT_UPDATED for a done row changes the displayed metrics and the totals input', () => {
    const { result, rerender } = renderForm(createSend(), createExchange());

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
    const { result, rerender } = renderForm(send, createExchange());

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
    (send as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      rerender({ lastEvent: measurementUpdated('uid-1') });
    });
    expect(send).not.toHaveBeenCalled();

    act(() => {
      rerender({ lastEvent: measurementUpdated('ghost-uid') });
    });
    expect(send).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
  });

  it('remove on a done row calls exchange with REMOVE_MEASUREMENT and drops the row immediately', () => {
    const exchange = createExchange();
    const { result, rerender } = renderForm(createSend(), exchange);

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
    expect(exchange).toHaveBeenCalledWith(
      'REMOVE_MEASUREMENT',
      expect.objectContaining({ rowId, measurementUid: 'uid-1' }),
    );
  });

  it('remove on a done row logs a warning instead of throwing when the exchange never answers', async () => {
    const exchange = createExchange(() => Promise.reject(new Error('timed out')));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    const { result, rerender } = renderForm(createSend(), exchange);

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

    await act(async () => {
      result.current.remove(rowId);
      await Promise.resolve();
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('a viewer-originated MEASUREMENT_REMOVED clears the done row to pending and never calls send', () => {
    const send = createSend();
    const { result, rerender } = renderForm(send, createExchange());

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
    (send as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      rerender({ lastEvent: measurementRemoved('uid-1') });
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row).toMatchObject({ status: RowStatus.Pending, metrics: null, measurementUid: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('focus on a done row sends FOCUS_MEASUREMENT with its measurementUid', () => {
    const send = createSend();
    const { result, rerender } = renderForm(send, createExchange());

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
    (send as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      result.current.focus(rowId);
    });

    expect(send).toHaveBeenCalledWith(
      'FOCUS_MEASUREMENT',
      expect.objectContaining({ rowId, measurementUid: 'uid-1' }),
    );
  });

  it('focus on a pending row sends nothing', () => {
    const send = createSend();
    const { result } = renderForm(send, createExchange());

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
    const { result } = renderForm(send, createExchange());

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    (send as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      result.current.remove(rowId);
    });

    expect(send).toHaveBeenCalledWith('DEACTIVATE_TOOL', expect.objectContaining({ rowId }));
    expect(result.current.rows).toHaveLength(0);
  });
});

describe('useScoringForm restore (A-14)', () => {
  it('calls exchange with RESTORE_MEASUREMENTS on the first VIEWER_READY when sessionStorage has rows', () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [storedRow('row-1', 'uid-1')]);
    const exchange = createExchange();
    const { rerender } = renderForm(createSend(), exchange);

    act(() => {
      rerender({ lastEvent: viewerReady() });
    });

    expect(exchange).toHaveBeenCalledWith(
      'RESTORE_MEASUREMENTS',
      expect.objectContaining({
        studyInstanceUid: FALLBACK_STUDY_INSTANCE_UID,
        measurements: [
          expect.objectContaining({ rowId: 'row-1', measurementUid: 'uid-1' }) as unknown,
        ],
      }),
    );
  });

  it('calls exchange with nothing when there is no stored state', () => {
    const exchange = createExchange();
    const { rerender } = renderForm(createSend(), exchange);

    act(() => {
      rerender({ lastEvent: viewerReady() });
    });

    expect(exchange).not.toHaveBeenCalled();
  });

  it('marks the failed rows and leaves the restored rows untouched once the exchange resolves', async () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [
      storedRow('row-1', 'uid-1'),
      storedRow('row-2', 'uid-2'),
    ]);
    const answer = measurementsRestored({
      restored: ['uid-1'],
      failed: [{ rowId: 'row-2', reason: 'invalid-geometry' }],
    });
    const exchange = createExchange(() => Promise.resolve(answer));
    const { result, rerender } = renderForm(createSend(), exchange);

    await act(async () => {
      rerender({ lastEvent: viewerReady() });
      await Promise.resolve();
    });

    const rowOne = result.current.rows.find((row) => row.rowId === 'row-1');
    const rowTwo = result.current.rows.find((row) => row.rowId === 'row-2');
    expect(rowOne).toMatchObject({ restoreFailureReason: null, status: RowStatus.Done });
    expect(rowTwo).toMatchObject({
      restoreFailureReason: 'invalid-geometry',
      status: RowStatus.Done,
    });
    expect(rowTwo?.metrics).toEqual({ area: { value: 124.5, unit: 'mm2' } });
  });

  it('a MEASUREMENTS_RESTORED reaching lastEvent directly is treated as unmatched and leaves rows untouched', () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [storedRow('row-1', 'uid-1')]);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    const { result, rerender } = renderForm(createSend(), createExchange());

    act(() => {
      rerender({ lastEvent: viewerReady() });
    });
    const rowsBefore = result.current.rows;

    act(() => {
      rerender({
        lastEvent: measurementsRestored({
          causedBy: 'unrelated-request',
          failed: [{ rowId: 'row-1', reason: 'unknown-study' }],
        }),
      });
    });

    expect(result.current.rows).toBe(rowsBefore);
    expect(debugSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
  });
});
