// Unit tests for the pure row-lifecycle reducer (canon C-4.3.2, C-4.3.7, Q-3, decision A-4).

import { describe, expect, it } from 'vitest';
import type { Metrics } from '@scoring/contract';
import { initialFormState, reducer, type FormState } from './rows';

const metrics: Metrics = { area: { value: 124.5, unit: 'mm2' } };

function addRows(state: FormState, ...rowIds: string[]): FormState {
  return rowIds.reduce((acc, rowId) => reducer(acc, { type: 'ADD_ROW', rowId }), state);
}

describe('rows reducer', () => {
  it('ADD_ROW appends a pending row', () => {
    const state = reducer(initialFormState, { type: 'ADD_ROW', rowId: 'row-1' });

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      rowId: 'row-1',
      status: 'pending',
      metrics: null,
      measurementUid: null,
    });
  });

  it('ADD_ROW does not touch armedRowId', () => {
    const state = reducer(initialFormState, { type: 'ADD_ROW', rowId: 'row-1' });
    expect(state.armedRowId).toBeNull();
  });

  it('ARM_ROW sets the target row to drawing and records armedRowId', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });

    expect(state.rows[0].status).toBe('drawing');
    expect(state.armedRowId).toBe('row-1');
  });

  it('arming row B disarms row A (only one armed row at a time)', () => {
    let state = addRows(initialFormState, 'row-a', 'row-b');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-a' });
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-b' });

    const rowA = state.rows.find((row) => row.rowId === 'row-a');
    const rowB = state.rows.find((row) => row.rowId === 'row-b');
    expect(rowA?.status).toBe('pending');
    expect(rowB?.status).toBe('drawing');
    expect(state.armedRowId).toBe('row-b');
  });

  it('ARM_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: 'ARM_ROW', rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('DISARM_ROW returns a drawing row to pending and clears armedRowId', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, { type: 'DISARM_ROW', rowId: 'row-1' });

    expect(state.rows[0].status).toBe('pending');
    expect(state.armedRowId).toBeNull();
  });

  it('DISARM_ROW on a pending (not drawing) row is a no-op', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: 'DISARM_ROW', rowId: 'row-1' });
    expect(next).toBe(state);
  });

  it('DISARM_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: 'DISARM_ROW', rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_RECEIVED applies to a drawing row: done, metrics, uid, armedRowId cleared', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_RECEIVED',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });

    expect(state.rows[0]).toMatchObject({
      status: 'done',
      metrics,
      measurementUid: 'uid-1',
    });
    expect(state.armedRowId).toBeNull();
  });

  it('measurement for a pending row is ignored', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, {
      type: 'MEASUREMENT_RECEIVED',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });
    expect(next).toBe(state);
  });

  it('measurement for a done row is ignored (no double-apply)', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: 'ARM_ROW', rowId: 'row-1' });
    state = reducer(state, {
      type: 'MEASUREMENT_RECEIVED',
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
    });
    const next = reducer(state, {
      type: 'MEASUREMENT_RECEIVED',
      rowId: 'row-1',
      measurementUid: 'uid-2',
      metrics: { area: { value: 1, unit: 'px2' } },
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_RECEIVED with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, {
      type: 'MEASUREMENT_RECEIVED',
      rowId: 'ghost',
      measurementUid: 'uid-1',
      metrics,
    });
    expect(next).toBe(state);
  });

  it('rows are unlimited: add 50 rows', () => {
    const rowIds = Array.from({ length: 50 }, (_, i) => `row-${i}`);
    const state = addRows(initialFormState, ...rowIds);
    expect(state.rows).toHaveLength(50);
    expect(state.rows.every((row) => row.status === 'pending')).toBe(true);
  });
});
