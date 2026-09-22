// Tests the React wiring around the row reducer: when the hook decides to send or exchange, not
// the reducer's outcome (covered in rows.test.ts). Driven through a real `createHostChannel`
// (A-22) with a fake viewer window, so a test proves the whole path from an incoming
// `MessageEvent` to the row that changed, not just that some mock was called.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type {
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  ViewerReadyEvent,
} from '@bdiadiun/scoring-contract';
import { DEFAULT_TOOL, FALLBACK_STUDY_INSTANCE_UID } from '@app/config';
import { RowStatus, type Row } from '@app/form/rows';
import { saveRows } from '@app/form/storage';
import { computeTotals } from '@app/form/totals';
import { useScoringForm } from '@app/form/useScoringForm';
import { createChannelHarness, disposeAllHarnessChannels, dispatchFromViewer } from './helpers';

// packages/channel/src/config.ts: EXCHANGE_TIMEOUT_MS, not part of the published surface.
const EXCHANGE_TIMEOUT_MS = 5000;

afterEach(() => {
  cleanup();
  disposeAllHarnessChannels();
  vi.useRealTimers();
});

// Every `HostCommand` carries a `requestId`; narrowed here by `type` so a test can read the id the
// channel issued without an unchecked cast on a value that might not have been posted at all.
const findPostedRequestId = (posted: HostCommand[], type: HostCommand['type']): string => {
  const command = posted.find((candidate) => candidate.type === type);
  if (command === undefined) {
    throw new Error(`no ${type} was posted`);
  }
  return command.requestId;
};

const viewerReady = (viewerVersion = '1.0.0'): ViewerReadyEvent => ({
  type: 'VIEWER_READY',
  viewerVersion,
});

const measurementAdded = (
  rowId: string | null,
  overrides: Partial<MeasurementAddedEvent> = {},
): MeasurementAddedEvent => ({
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
  type: 'MEASUREMENT_REMOVED',
  measurementUid,
  ...overrides,
});

const measurementsRestored = (
  overrides: Partial<MeasurementsRestoredEvent> = {},
): MeasurementsRestoredEvent => ({
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

describe('useScoringForm outgoing commands', () => {
  it('activate sends ACTIVATE_TOOL with the row id and the configured default tool', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));

    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;

    act(() => {
      result.current.activate(rowId);
    });

    expect(posted()).toContainEqual(
      expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId, toolName: DEFAULT_TOOL }),
    );
  });

  it('activate sends the length tool for a row added as a length row', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));

    act(() => {
      result.current.addRow('Length');
    });
    const rowId = result.current.rows[0].rowId;

    act(() => {
      result.current.activate(rowId);
    });

    expect(posted()).toContainEqual(
      expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId, toolName: 'Length' }),
    );
  });

  it('addRow with no argument still uses the configured area tool', () => {
    const { channel } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(channel));

    act(() => {
      result.current.addRow();
    });

    expect(result.current.rows[0].toolName).toBe(DEFAULT_TOOL);
  });

  it('activating a second row deactivates the first: only one row is armed at a time (A-4)', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
      result.current.addRow();
    });
    const [rowA, rowB] = result.current.rows;

    act(() => {
      result.current.activate(rowA.rowId);
    });
    act(() => {
      result.current.activate(rowB.rowId);
    });

    expect(posted()).toContainEqual(
      expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId: rowA.rowId }),
    );
    expect(posted()).toContainEqual(
      expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId: rowB.rowId }),
    );
    expect(result.current.rows.find((row) => row.rowId === rowA.rowId)?.status).toBe(
      RowStatus.Pending,
    );
    expect(result.current.rows.find((row) => row.rowId === rowB.rowId)?.status).toBe(
      RowStatus.Drawing,
    );
  });

  it('focus on a done row sends FOCUS_MEASUREMENT with its measurementUid', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    act(() => {
      dispatchFromViewer(measurementAdded(rowId));
    });

    act(() => {
      result.current.focus(rowId);
    });

    expect(posted()).toContainEqual(
      expect.objectContaining({ type: 'FOCUS_MEASUREMENT', rowId, measurementUid: 'uid-1' }),
    );
  });

  it('focus on a pending row sends nothing', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;

    act(() => {
      result.current.focus(rowId);
    });

    expect(posted()).toHaveLength(0);
  });

  it('cancel sends DEACTIVATE_TOOL and returns the drawing row to pending', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    act(() => {
      result.current.cancel(rowId);
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId }));
    expect(result.current.rows[0].status).toBe(RowStatus.Pending);
  });

  it('remove on a drawing row sends DEACTIVATE_TOOL then drops the row', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    act(() => {
      result.current.remove(rowId);
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId }));
    expect(result.current.rows).toHaveLength(0);
  });
});

describe('useScoringForm incoming measurements', () => {
  it('a MEASUREMENT_ADDED for the armed row moves it to done with metrics, uid and geometry', () => {
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    const geometry = {
      frameOfReferenceUid: 'for-1',
      referencedImageId: 'image-1',
      points: [[1, 2, 3]],
    };
    act(() => {
      dispatchFromViewer(measurementAdded(rowId, { geometry }));
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Done);
    expect(row?.metrics).toEqual({ area: { value: 124.5, unit: 'mm2' } });
    expect(row?.measurementUid).toBe('uid-1');
    expect(row?.geometry).toEqual(geometry);
  });

  it('a MEASUREMENT_ADDED with rowId: null (no armed row, A-8) changes nothing', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    act(() => {
      dispatchFromViewer(measurementAdded(null));
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Drawing);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('ignored'), 'uid-1');

    infoSpy.mockRestore();
  });

  it('a MEASUREMENT_ADDED for a pending (not armed) row changes nothing', () => {
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    const rowsBefore = result.current.rows;

    act(() => {
      dispatchFromViewer(measurementAdded(rowId));
    });

    expect(result.current.rows).toBe(rowsBefore);
  });

  it('two events for the same measurement delivered back-to-back in one tick are both applied', () => {
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });

    act(() => {
      dispatchFromViewer(measurementAdded(rowId));
      dispatchFromViewer(
        measurementUpdated('uid-1', { metrics: { area: { value: 200, unit: 'mm2' } } }),
      );
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Done);
    expect(row?.metrics).toEqual({ area: { value: 200, unit: 'mm2' } });
  });

  it('MEASUREMENT_UPDATED for an untracked measurementUid leaves rows unchanged', () => {
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowsBefore = result.current.rows;

    act(() => {
      dispatchFromViewer(measurementUpdated('ghost-uid'));
    });

    expect(result.current.rows).toBe(rowsBefore);
  });

  it('MEASUREMENT_UPDATED never triggers a command (Q-4: no echo loop on the host side)', () => {
    const { channel, viewerWindow, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
      dispatchFromViewer(measurementAdded(rowId));
    });
    viewerWindow.postMessage.mockClear();

    act(() => {
      dispatchFromViewer(measurementUpdated('uid-1'));
    });

    expect(posted()).toHaveLength(0);
  });

  it('MEASUREMENT_REMOVED for an untracked measurementUid leaves rows unchanged', () => {
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowsBefore = result.current.rows;

    act(() => {
      dispatchFromViewer(measurementRemoved('ghost-uid'));
    });

    expect(result.current.rows).toBe(rowsBefore);
  });

  it('a viewer-originated MEASUREMENT_REMOVED clears the matching done row back to pending', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
      dispatchFromViewer(measurementAdded(rowId));
    });
    const postedSoFar = posted().length;

    act(() => {
      dispatchFromViewer(measurementRemoved('uid-1'));
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row).toMatchObject({ status: RowStatus.Pending, metrics: null, measurementUid: null });
    expect(posted()).toHaveLength(postedSoFar);
  });

  it('totals reflect a MEASUREMENT_UPDATED replacing the displayed metrics', () => {
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
      dispatchFromViewer(measurementAdded(rowId));
    });
    expect(computeTotals(result.current.rows, 'area')).toEqual([
      { unit: 'mm2', value: 124.5, count: 1 },
    ]);

    act(() => {
      dispatchFromViewer(
        measurementUpdated('uid-1', { metrics: { area: { value: 200, unit: 'mm2' } } }),
      );
    });

    expect(computeTotals(result.current.rows, 'area')).toEqual([
      { unit: 'mm2', value: 200, count: 1 },
    ]);
  });
});

describe('useScoringForm remove exchange (A-21)', () => {
  it('remove on a done row sends REMOVE_MEASUREMENT and drops the row immediately, optimistically', () => {
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
      dispatchFromViewer(measurementAdded(rowId));
    });

    act(() => {
      result.current.remove(rowId);
    });

    expect(result.current.rows).toHaveLength(0);
    expect(posted()).toContainEqual(
      expect.objectContaining({ type: 'REMOVE_MEASUREMENT', rowId, measurementUid: 'uid-1' }),
    );
  });

  it('the echo answering our own REMOVE_MEASUREMENT is consumed by the exchange, not left to time out', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { channel, posted } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
      dispatchFromViewer(measurementAdded(rowId));
    });

    act(() => {
      result.current.remove(rowId);
    });
    const requestId = findPostedRequestId(posted(), 'REMOVE_MEASUREMENT');

    act(() => {
      dispatchFromViewer(measurementRemoved('uid-1', { causedBy: requestId }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EXCHANGE_TIMEOUT_MS);
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('remove on a done row logs a warning instead of throwing when the exchange never answers', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { channel } = createChannelHarness();
    dispatchFromViewer(viewerReady());
    const { result } = renderHook(() => useScoringForm(channel));
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
      dispatchFromViewer(measurementAdded(rowId));
    });

    act(() => {
      result.current.remove(rowId);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EXCHANGE_TIMEOUT_MS);
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('useScoringForm restore (A-14)', () => {
  it('requests RESTORE_MEASUREMENTS on the first VIEWER_READY when sessionStorage has rows', () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [storedRow('row-1', 'uid-1')]);
    const { channel, posted } = createChannelHarness();
    renderHook(() => useScoringForm(channel));

    dispatchFromViewer(viewerReady());

    expect(posted()).toContainEqual(
      expect.objectContaining({
        type: 'RESTORE_MEASUREMENTS',
        studyInstanceUid: FALLBACK_STUDY_INSTANCE_UID,
        measurements: [expect.objectContaining({ rowId: 'row-1', measurementUid: 'uid-1' })],
      }),
    );
  });

  it('requests nothing when there is no stored state', () => {
    const { channel, posted } = createChannelHarness();
    renderHook(() => useScoringForm(channel));

    dispatchFromViewer(viewerReady());

    expect(posted().filter((command) => command.type === 'RESTORE_MEASUREMENTS')).toHaveLength(0);
  });

  it('marks the failed rows and leaves the restored rows untouched once the exchange resolves', async () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [
      storedRow('row-1', 'uid-1'),
      storedRow('row-2', 'uid-2'),
    ]);
    const { channel, posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(channel));

    dispatchFromViewer(viewerReady());
    const requestId = findPostedRequestId(posted(), 'RESTORE_MEASUREMENTS');
    await act(async () => {
      dispatchFromViewer(
        measurementsRestored({
          causedBy: requestId,
          restored: ['uid-1'],
          failed: [{ rowId: 'row-2', reason: 'invalid-geometry' }],
        }),
      );
      await Promise.resolve();
    });

    const rowOne = result.current.rows.find((row) => row.rowId === 'row-1');
    const rowTwo = result.current.rows.find((row) => row.rowId === 'row-2');
    expect(rowOne).toMatchObject({ restoreFailureReason: null, status: RowStatus.Done });
    expect(rowTwo).toMatchObject({
      restoreFailureReason: 'invalid-geometry',
      status: RowStatus.Done,
    });
  });

  it('re-arms the drawing row on a second VIEWER_READY (viewer reload)', () => {
    const { channel, viewerWindow, posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(channel));
    // The first READY the form itself sees; with nothing stored, restore is a no-op.
    dispatchFromViewer(viewerReady());
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
    });
    viewerWindow.postMessage.mockClear();

    dispatchFromViewer(viewerReady());

    expect(posted()).toContainEqual(
      expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId, toolName: DEFAULT_TOOL }),
    );
  });
});
