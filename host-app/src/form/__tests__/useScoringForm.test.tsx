// Tests the React wiring around the row reducer: when the hook decides to send, not the reducer's
// outcome (covered in rows.test.ts). Driven through a real `createHostChannel` with a fake viewer
// window, so a test proves the whole path from an incoming `MessageEvent` to the row that changed,
// not just that some mock was called.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type {
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

afterEach(() => {
  cleanup();
  disposeAllHarnessChannels();
  vi.useRealTimers();
});

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

const GEOMETRY = {
  frameOfReferenceUid: 'for-1',
  referencedImageId: 'image-1',
  points: [[1, 2, 3]],
};

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

  it('activating a second row sends one ACTIVATE_TOOL and no DEACTIVATE_TOOL (A-4, A-30)', () => {
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

    expect(posted().filter((command) => command.type === 'DEACTIVATE_TOOL')).toEqual([]);
    expect(posted().filter((command) => command.type === 'ACTIVATE_TOOL')).toEqual([
      { version: 1, type: 'ACTIVATE_TOOL', rowId: rowA.rowId, toolName: DEFAULT_TOOL },
      { version: 1, type: 'ACTIVATE_TOOL', rowId: rowB.rowId, toolName: DEFAULT_TOOL },
    ]);
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
      expect.objectContaining({ type: 'FOCUS_MEASUREMENT', measurementUid: 'uid-1' }),
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

    act(() => {
      dispatchFromViewer(measurementAdded(rowId, { geometry: GEOMETRY }));
    });

    const row = result.current.rows.find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Done);
    expect(row?.metrics).toEqual({ area: { value: 124.5, unit: 'mm2' } });
    expect(row?.measurementUid).toBe('uid-1');
    expect(row?.geometry).toEqual(GEOMETRY);
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

describe('useScoringForm remove (A-30)', () => {
  it('remove on a done row drops the row and sends REMOVE_MEASUREMENT naming only the measurement', () => {
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
    expect(posted()).toContainEqual({
      version: 1,
      type: 'REMOVE_MEASUREMENT',
      measurementUid: 'uid-1',
    });
  });

  it("leaves the rows untouched when the viewer's own MEASUREMENT_REMOVED follows that removal", () => {
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
    const rowsAfterRemoval = result.current.rows;
    const postedSoFar = posted().length;

    act(() => {
      dispatchFromViewer(measurementRemoved('uid-1'));
    });

    expect(result.current.rows).toBe(rowsAfterRemoval);
    expect(posted()).toHaveLength(postedSoFar);
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

  it('marks the failed rows and leaves the restored rows untouched when MEASUREMENTS_RESTORED arrives', () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [
      storedRow('row-1', 'uid-1'),
      storedRow('row-2', 'uid-2'),
    ]);
    const { channel } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(channel));

    dispatchFromViewer(viewerReady());
    act(() => {
      dispatchFromViewer(
        measurementsRestored({
          restored: ['uid-1'],
          failed: [{ rowId: 'row-2', reason: 'invalid-geometry' }],
        }),
      );
    });

    const rowOne = result.current.rows.find((row) => row.rowId === 'row-1');
    const rowTwo = result.current.rows.find((row) => row.rowId === 'row-2');
    expect(rowOne).toMatchObject({ restoreFailureReason: null, status: RowStatus.Done });
    expect(rowTwo).toMatchObject({
      restoreFailureReason: 'invalid-geometry',
      status: RowStatus.Done,
    });
  });

  it('offers the rows drawn this session again on a second VIEWER_READY', () => {
    const { channel, viewerWindow, posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(channel));
    dispatchFromViewer(viewerReady());
    act(() => {
      result.current.addRow();
    });
    const rowId = result.current.rows[0].rowId;
    act(() => {
      result.current.activate(rowId);
      dispatchFromViewer(measurementAdded(rowId, { geometry: GEOMETRY }));
    });
    viewerWindow.postMessage.mockClear();

    dispatchFromViewer(viewerReady());

    expect(posted()).toContainEqual(
      expect.objectContaining({
        type: 'RESTORE_MEASUREMENTS',
        studyInstanceUid: FALLBACK_STUDY_INSTANCE_UID,
        measurements: [
          expect.objectContaining({ rowId, measurementUid: 'uid-1', geometry: GEOMETRY }),
        ],
      }),
    );
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
