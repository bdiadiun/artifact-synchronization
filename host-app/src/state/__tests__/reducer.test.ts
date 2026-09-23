import { describe, expect, it } from 'vitest';
import type { Metrics } from '@bdiadiun/scoring-contract';
import { RowStatus, reducer, type Row } from '@app/state/reducer';
import { findRow, findRowByUid } from '@app/state/selectors';

const metrics: Metrics = { area: { value: 124.5, unit: 'mm2' } };

const addRows = (state: Row[], ...rowIds: string[]): Row[] =>
  rowIds.reduce(
    (acc, rowId) => reducer(acc, { type: 'ADD_ROW', rowId, toolName: 'EllipticalROI' }),
    state,
  );

const isDrawing = (state: Row[], rowId: string): boolean =>
  state.find((row) => row.rowId === rowId)?.status === RowStatus.Drawing;

describe('rows reducer', () => {
  it('ADD_ROW appends a pending row', () => {
    const state = reducer([], {
      type: 'ADD_ROW',
      rowId: 'row-1',
      toolName: 'EllipticalROI',
    });

    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({
      rowId: 'row-1',
      status: RowStatus.Pending,
      metrics: null,
      measurementUid: null,
      restoreFailureReason: null,
    });
  });

  it('ADD_ROW keeps the given toolName on the new row', () => {
    const state = reducer([], {
      type: 'ADD_ROW',
      rowId: 'row-1',
      toolName: 'Length',
    });
    expect(state[0].toolName).toBe('Length');
  });

  it('ARM_ROW sets the target row to drawing', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });

    expect(isDrawing(state, 'row-1')).toBe(true);
  });

  it('arming row B disarms row A (only one row is drawing at a time, A-4)', () => {
    let state = addRows([], 'row-a', 'row-b');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-a' });
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-b' });

    expect(isDrawing(state, 'row-a')).toBe(false);
    expect(isDrawing(state, 'row-b')).toBe(true);
  });

  it('re-arming the already drawing row leaves state unchanged', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    const next = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });

    expect(next).toBe(state);
  });

  it('ARM_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, { type: 'ARM_ROW', rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('DISARM_ROW returns a drawing row to pending', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, { type: 'DISARM_ROW', rowId: 'row-1' });

    expect(isDrawing(state, 'row-1')).toBe(false);
    expect(state[0].status).toBe(RowStatus.Pending);
  });

  it('DISARM_ROW on a pending (not drawing) row is a no-op', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, { type: 'DISARM_ROW', rowId: 'row-1' });
    expect(next).toBe(state);
  });

  it('DISARM_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, { type: 'DISARM_ROW', rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_RECEIVED applies to a drawing row: done, with metrics, uid and geometry', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    const geometry = {
      frameOfReferenceUid: 'for-1',
      referencedImageId: 'image-1',
      points: [[1, 2, 3]],
    };
    state = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry,
    });

    expect(state[0]).toMatchObject({
      status: RowStatus.Done,
      metrics,
      measurementUid: 'uid-1',
      geometry,
    });
  });

  it('MEASUREMENT_RECEIVED for a pending (not drawing) row is ignored', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_RECEIVED for an already done row is ignored (no double-apply)', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });
    const next = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-2',
      metrics: { area: { value: 1, unit: 'px2' } },
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_RECEIVED with an unknown rowId leaves state unchanged', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'ghost',
      measurementUid: 'uid-1',
      metrics,
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_UPDATED replaces the metrics of the matching done row', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });

    const updatedMetrics: Metrics = { area: { value: 200, unit: 'mm2' } };
    const next = reducer(state, {
      type: 'MEASUREMENT_UPDATED',
      toolName: 'EllipticalROI',
      measurementUid: 'uid-1',
      metrics: updatedMetrics,
    });

    expect(next[0]).toMatchObject({
      status: RowStatus.Done,
      metrics: updatedMetrics,
      measurementUid: 'uid-1',
    });
  });

  it('MEASUREMENT_UPDATED with an unknown measurementUid leaves state unchanged', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });

    const next = reducer(state, {
      type: 'MEASUREMENT_UPDATED',
      toolName: 'EllipticalROI',
      measurementUid: 'ghost',
      metrics: { area: { value: 999, unit: 'mm2' } },
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_UPDATED for a pending row with the same uid leaves state unchanged', () => {
    // A row is only ever `pending` with a `measurementUid` in a contrived/defensive scenario
    // (normally uid is set exactly when status becomes `done`), but the reducer must still refuse
    // to update anything but a `done` row - checked directly by constructing that state.
    const state: Row[] = [
      {
        rowId: 'row-1',
        status: RowStatus.Pending,
        toolName: 'EllipticalROI',
        metrics: null,
        measurementUid: 'uid-1',
        geometry: null,
        restoreFailureReason: null,
      },
    ];

    const next = reducer(state, {
      type: 'MEASUREMENT_UPDATED',
      toolName: 'EllipticalROI',
      measurementUid: 'uid-1',
      metrics,
    });
    expect(next).toBe(state);
  });

  it('REMOVE_ROW drops the named row and leaves the others', () => {
    let state = addRows([], 'row-1', 'row-2');
    state = reducer(state, { type: 'REMOVE_ROW', rowId: 'row-1' });

    expect(state.map((row) => row.rowId)).toEqual(['row-2']);
  });

  it('REMOVE_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, { type: 'REMOVE_ROW', rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_CLEARED returns the done row matching the uid to pending, metrics and uid cleared', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });

    const next = reducer(state, {
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'uid-1',
    });

    expect(next[0]).toMatchObject({
      status: RowStatus.Pending,
      metrics: null,
      measurementUid: null,
    });
  });

  it('MEASUREMENT_CLEARED for an unknown measurementUid leaves state unchanged', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, {
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'ghost',
    });
    expect(next).toBe(state);
  });

  it('a row keeps its own toolName through arm/measure/clear (re-arm uses the same tool)', () => {
    let state = reducer([], {
      type: 'ADD_ROW',
      rowId: 'row-1',
      toolName: 'Length',
    });
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics: { length: { value: 12, unit: 'mm' } },
    });
    state = reducer(state, { type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1' });

    expect(state[0].toolName).toBe('Length');
  });

  it('rows are unlimited: adding 50 rows keeps them all pending', () => {
    const rowIds = Array.from({ length: 50 }, (_, i) => `row-${String(i)}`);
    const state = addRows([], ...rowIds);
    expect(state).toHaveLength(50);
    expect(state.every((row) => row.status === RowStatus.Pending)).toBe(true);
  });

  it('RESTORE_FAILED marks the row with the given reason and keeps its value', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_ADDED',
      toolName: 'EllipticalROI',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });

    const next = reducer(state, {
      type: 'MEASUREMENTS_RESTORED',
      restored: [],
      failed: [{ rowId: 'row-1', reason: 'viewer-error' }],
    });

    expect(next[0]).toMatchObject({
      status: RowStatus.Done,
      metrics,
      restoreFailureReason: 'viewer-error',
    });
  });

  it('RESTORE_FAILED with an unknown rowId leaves state unchanged', () => {
    const state = addRows([], 'row-1');
    const next = reducer(state, {
      type: 'MEASUREMENTS_RESTORED',
      restored: [],
      failed: [{ rowId: 'ghost', reason: 'unknown-study' }],
    });
    expect(next).toBe(state);
  });

  it('RESTORE_FAILED twice with the same reason is a no-op the second time', () => {
    let state = addRows([], 'row-1');
    state = reducer(state, {
      type: 'MEASUREMENTS_RESTORED',
      restored: [],
      failed: [{ rowId: 'row-1', reason: 'viewer-error' }],
    });
    const next = reducer(state, {
      type: 'MEASUREMENTS_RESTORED',
      restored: [],
      failed: [{ rowId: 'row-1', reason: 'viewer-error' }],
    });
    expect(next).toBe(state);
  });
});

const storedRow = (rowId: string, measurementUid: string | null): Row => ({
  rowId,
  status: measurementUid === null ? RowStatus.Pending : RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: null,
  measurementUid,
  geometry: null,
  restoreFailureReason: null,
});

const storedRows: Row[] = [storedRow('row-1', null), storedRow('row-2', 'uid-2')];

describe('findRow', () => {
  it('returns the row with the given id', () => {
    expect(findRow(storedRows, 'row-2')).toBe(storedRows[1]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findRow(storedRows, 'row-9')).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(findRow([], 'row-1')).toBeUndefined();
  });
});

describe('findRowByUid', () => {
  it('returns the row carrying the measurement uid', () => {
    expect(findRowByUid(storedRows, 'uid-2')).toBe(storedRows[1]);
  });

  it('never matches a row without a measurement', () => {
    expect(findRowByUid(storedRows, 'uid-9')).toBeUndefined();
  });
});
