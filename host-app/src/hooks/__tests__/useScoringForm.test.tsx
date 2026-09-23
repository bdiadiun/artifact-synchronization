// Tests the React wiring around the row reducer: when the hook decides to send, not the reducer's
// outcome (covered in rows.test.ts). Driven through a real `createHostChannel` with a fake viewer
// window, so a test proves the whole path from an incoming `MessageEvent` to the row that changed,
// not just that some mock was called.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type {
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  ViewerEvent,
  ViewerReadyEvent,
} from '@bdiadiun/scoring-contract';
import { DEFAULT_TOOL, FALLBACK_STUDY_INSTANCE_UID, VIEWER_ORIGIN } from '@app/config';
import { RowStatus, type Row } from '@app/state/reducer';
import { saveRows } from '@app/state/storedRows';
import { computeTotals } from '@app/utils/totals';
import { useScoringForm } from '@app/hooks/useScoringForm';
import { activateRow, addRow, cancelRow, focusRow, removeRow } from '@app/state/actions';

const rowById = (rows: readonly Row[], rowId: string): Row => {
  const row = rows.find((candidate) => candidate.rowId === rowId);
  if (row === undefined) {
    throw new Error(`no row ${rowId}`);
  }
  return row;
};

interface ChannelHarness {
  posted: () => HostCommand[];
  clearPosted: () => void;
}

const disposeAllHarnessChannels = (): void => {
  vi.restoreAllMocks();
};

const createChannelHarness = (): ChannelHarness => {
  const spy = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);

  return {
    posted: (): HostCommand[] => spy.mock.calls.map(([message]) => message as HostCommand),
    clearPosted: (): void => {
      spy.mockClear();
    },
  };
};

// The contract version lives on the wire, not in the message types (A-25), so it is stamped here
// the way the viewer's channel stamps it; without it the host's channel drops the event.
const dispatchFromViewer = (event: ViewerEvent, origin = VIEWER_ORIGIN): void => {
  window.dispatchEvent(new MessageEvent('message', { data: { version: 1, ...event }, origin, source: window }));
};

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

const measurementsRestored = (overrides: Partial<MeasurementsRestoredEvent> = {}): MeasurementsRestoredEvent => ({
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
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());

    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;

    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId, toolName: DEFAULT_TOOL }));
  });

  it('activate sends the length tool for a row added as a length row', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());

    act(() => {
      addRow(result.current[1], 'Length');
    });
    const rowId = result.current[0][0].rowId;

    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId, toolName: 'Length' }));
  });

  it('addRow with no argument still uses the configured area tool', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));

    act(() => {
      addRow(result.current[1]);
    });

    expect(result.current[0][0].toolName).toBe(DEFAULT_TOOL);
  });

  it('activating a second row sends one ACTIVATE_TOOL and no DEACTIVATE_TOOL (A-4, A-30)', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
      addRow(result.current[1]);
    });
    const [rowA, rowB] = result.current[0];

    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowA.rowId));
    });
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowB.rowId));
    });

    expect(posted().filter((command) => command.type === 'DEACTIVATE_TOOL')).toEqual([]);
    expect(posted().filter((command) => command.type === 'ACTIVATE_TOOL')).toEqual([
      { version: 1, type: 'ACTIVATE_TOOL', rowId: rowA.rowId, toolName: DEFAULT_TOOL },
      { version: 1, type: 'ACTIVATE_TOOL', rowId: rowB.rowId, toolName: DEFAULT_TOOL },
    ]);
    expect(result.current[0].find((row) => row.rowId === rowA.rowId)?.status).toBe(RowStatus.Pending);
    expect(result.current[0].find((row) => row.rowId === rowB.rowId)?.status).toBe(RowStatus.Drawing);
  });

  it('focus on a done row sends FOCUS_MEASUREMENT with its measurementUid', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });
    act(() => {
      dispatchFromViewer(measurementAdded(rowId));
    });

    act(() => {
      focusRow(result.current[1], rowById(result.current[0], rowId));
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'FOCUS_MEASUREMENT', measurementUid: 'uid-1' }));
  });

  it('focus on a pending row sends nothing', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;

    act(() => {
      focusRow(result.current[1], rowById(result.current[0], rowId));
    });

    expect(posted()).toHaveLength(0);
  });

  it('cancel sends DEACTIVATE_TOOL and returns the drawing row to pending', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });

    act(() => {
      cancelRow(result.current[1], rowById(result.current[0], rowId));
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId }));
    expect(result.current[0][0].status).toBe(RowStatus.Pending);
  });

  it('remove on a drawing row sends DEACTIVATE_TOOL then drops the row', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });

    act(() => {
      removeRow(result.current[1], rowById(result.current[0], rowId));
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId }));
    expect(result.current[0]).toHaveLength(0);
  });
});

describe('useScoringForm incoming measurements', () => {
  it('a MEASUREMENT_ADDED for the armed row moves it to done with metrics, uid and geometry', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });

    act(() => {
      dispatchFromViewer(measurementAdded(rowId, { geometry: GEOMETRY }));
    });

    const row = result.current[0].find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Done);
    expect(row?.metrics).toEqual({ area: { value: 124.5, unit: 'mm2' } });
    expect(row?.measurementUid).toBe('uid-1');
    expect(row?.geometry).toEqual(GEOMETRY);
  });

  it('a MEASUREMENT_ADDED with rowId: null (no armed row, A-8) changes nothing', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });

    act(() => {
      dispatchFromViewer(measurementAdded(null));
    });

    const row = result.current[0].find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Drawing);
  });

  it('a MEASUREMENT_ADDED for a pending (not armed) row changes nothing', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    const rowsBefore = result.current[0];

    act(() => {
      dispatchFromViewer(measurementAdded(rowId));
    });

    expect(result.current[0]).toBe(rowsBefore);
  });

  it('two events for the same measurement delivered back-to-back in one tick are both applied', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });

    act(() => {
      dispatchFromViewer(measurementAdded(rowId));
      dispatchFromViewer(measurementUpdated('uid-1', { metrics: { area: { value: 200, unit: 'mm2' } } }));
    });

    const row = result.current[0].find((r) => r.rowId === rowId);
    expect(row?.status).toBe(RowStatus.Done);
    expect(row?.metrics).toEqual({ area: { value: 200, unit: 'mm2' } });
  });

  it('MEASUREMENT_UPDATED for an untracked measurementUid leaves rows unchanged', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowsBefore = result.current[0];

    act(() => {
      dispatchFromViewer(measurementUpdated('ghost-uid'));
    });

    expect(result.current[0]).toBe(rowsBefore);
  });

  it('MEASUREMENT_UPDATED never triggers a command (Q-4: no echo loop on the host side)', () => {
    const { posted, clearPosted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
      dispatchFromViewer(measurementAdded(rowId));
    });
    clearPosted();

    act(() => {
      dispatchFromViewer(measurementUpdated('uid-1'));
    });

    expect(posted()).toHaveLength(0);
  });

  it('MEASUREMENT_REMOVED for an untracked measurementUid leaves rows unchanged', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowsBefore = result.current[0];

    act(() => {
      dispatchFromViewer(measurementRemoved('ghost-uid'));
    });

    expect(result.current[0]).toBe(rowsBefore);
  });

  it('a viewer-originated MEASUREMENT_REMOVED clears the matching done row back to pending', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
      dispatchFromViewer(measurementAdded(rowId));
    });
    const postedSoFar = posted().length;

    act(() => {
      dispatchFromViewer(measurementRemoved('uid-1'));
    });

    const row = result.current[0].find((r) => r.rowId === rowId);
    expect(row).toMatchObject({ status: RowStatus.Pending, metrics: null, measurementUid: null });
    expect(posted()).toHaveLength(postedSoFar);
  });

  it('totals reflect a MEASUREMENT_UPDATED replacing the displayed metrics', () => {
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
      dispatchFromViewer(measurementAdded(rowId));
    });
    expect(computeTotals(result.current[0], 'area')).toEqual([{ unit: 'mm2', value: 124.5, count: 1 }]);

    act(() => {
      dispatchFromViewer(measurementUpdated('uid-1', { metrics: { area: { value: 200, unit: 'mm2' } } }));
    });

    expect(computeTotals(result.current[0], 'area')).toEqual([{ unit: 'mm2', value: 200, count: 1 }]);
  });
});

describe('useScoringForm remove (A-30)', () => {
  it('remove on a done row drops the row and sends REMOVE_MEASUREMENT naming only the measurement', () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
      dispatchFromViewer(measurementAdded(rowId));
    });

    act(() => {
      removeRow(result.current[1], rowById(result.current[0], rowId));
    });

    expect(result.current[0]).toHaveLength(0);
    expect(posted()).toContainEqual({
      version: 1,
      type: 'REMOVE_MEASUREMENT',
      measurementUid: 'uid-1',
    });
  });

  it("leaves the rows untouched when the viewer's own MEASUREMENT_REMOVED follows that removal", () => {
    const { posted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
      dispatchFromViewer(measurementAdded(rowId));
    });
    act(() => {
      removeRow(result.current[1], rowById(result.current[0], rowId));
    });
    const rowsAfterRemoval = result.current[0];
    const postedSoFar = posted().length;

    act(() => {
      dispatchFromViewer(measurementRemoved('uid-1'));
    });

    expect(result.current[0]).toBe(rowsAfterRemoval);
    expect(posted()).toHaveLength(postedSoFar);
  });
});

describe('useScoringForm restore (A-14)', () => {
  it('requests RESTORE_MEASUREMENTS on the first VIEWER_READY when sessionStorage has rows', () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [storedRow('row-1', 'uid-1')]);
    const { posted } = createChannelHarness();
    renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));

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
    const { posted } = createChannelHarness();
    renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));

    dispatchFromViewer(viewerReady());

    expect(posted().filter((command) => command.type === 'RESTORE_MEASUREMENTS')).toHaveLength(0);
  });

  it('marks the failed rows and leaves the restored rows untouched when MEASUREMENTS_RESTORED arrives', () => {
    saveRows(FALLBACK_STUDY_INSTANCE_UID, [storedRow('row-1', 'uid-1'), storedRow('row-2', 'uid-2')]);
    createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));

    dispatchFromViewer(viewerReady());
    act(() => {
      dispatchFromViewer(
        measurementsRestored({
          restored: ['uid-1'],
          failed: [{ rowId: 'row-2', reason: 'viewer-error' }],
        }),
      );
    });

    const rowOne = result.current[0].find((row) => row.rowId === 'row-1');
    const rowTwo = result.current[0].find((row) => row.rowId === 'row-2');
    expect(rowOne).toMatchObject({ restoreFailureReason: null, status: RowStatus.Done });
    expect(rowTwo).toMatchObject({
      restoreFailureReason: 'viewer-error',
      status: RowStatus.Done,
    });
  });

  it('offers the rows drawn this session again on a second VIEWER_READY', () => {
    const { posted, clearPosted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
      dispatchFromViewer(measurementAdded(rowId, { geometry: GEOMETRY }));
    });
    clearPosted();

    act(() => {
      dispatchFromViewer(viewerReady());
    });

    expect(posted()).toContainEqual(
      expect.objectContaining({
        type: 'RESTORE_MEASUREMENTS',
        studyInstanceUid: FALLBACK_STUDY_INSTANCE_UID,
        measurements: [expect.objectContaining({ rowId, measurementUid: 'uid-1', geometry: GEOMETRY })],
      }),
    );
  });

  it('re-arms the drawing row on a second VIEWER_READY (viewer reload)', () => {
    const { posted, clearPosted } = createChannelHarness();
    const { result } = renderHook(() => useScoringForm(FALLBACK_STUDY_INSTANCE_UID));
    // The first READY the form itself sees; with nothing stored, restore is a no-op.
    dispatchFromViewer(viewerReady());
    act(() => {
      addRow(result.current[1]);
    });
    const rowId = result.current[0][0].rowId;
    act(() => {
      activateRow(result.current[1], rowById(result.current[0], rowId));
    });
    clearPosted();

    act(() => {
      dispatchFromViewer(viewerReady());
    });

    expect(posted()).toContainEqual(expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId, toolName: DEFAULT_TOOL }));
  });
});
