import { describe, expect, it } from 'vitest';
import type { Metrics } from '@bdiadiun/scoring-contract';
import {
  FormActionType,
  RowStatus,
  initialFormState,
  reducer,
  type FormState,
} from '@app/form/rows';

const metrics: Metrics = { area: { value: 124.5, unit: 'mm2' } };

const addRows = (state: FormState, ...rowIds: string[]): FormState =>
  rowIds.reduce(
    (acc, rowId) => reducer(acc, { type: FormActionType.AddRow, rowId, toolName: 'EllipticalROI' }),
    state,
  );

describe('rows reducer', () => {
  it('ADD_ROW appends a pending row', () => {
    const state = reducer(initialFormState, {
      type: FormActionType.AddRow,
      rowId: 'row-1',
      toolName: 'EllipticalROI',
    });

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      rowId: 'row-1',
      status: RowStatus.Pending,
      metrics: null,
      measurementUid: null,
    });
  });

  it('ADD_ROW does not touch armedRowId', () => {
    const state = reducer(initialFormState, {
      type: FormActionType.AddRow,
      rowId: 'row-1',
      toolName: 'EllipticalROI',
    });
    expect(state.armedRowId).toBeNull();
  });

  it('ARM_ROW sets the target row to drawing and records armedRowId', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });

    expect(state.rows[0].status).toBe(RowStatus.Drawing);
    expect(state.armedRowId).toBe('row-1');
  });

  it('arming row B disarms row A (only one armed row at a time)', () => {
    let state = addRows(initialFormState, 'row-a', 'row-b');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-a' });
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-b' });

    const rowA = state.rows.find((row) => row.rowId === 'row-a');
    const rowB = state.rows.find((row) => row.rowId === 'row-b');
    expect(rowA?.status).toBe(RowStatus.Pending);
    expect(rowB?.status).toBe(RowStatus.Drawing);
    expect(state.armedRowId).toBe('row-b');
  });

  it('ARM_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: FormActionType.ArmRow, rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('DISARM_ROW returns a drawing row to pending and clears armedRowId', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, { type: FormActionType.DisarmRow, rowId: 'row-1' });

    expect(state.rows[0].status).toBe(RowStatus.Pending);
    expect(state.armedRowId).toBeNull();
  });

  it('DISARM_ROW on a pending (not drawing) row is a no-op', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: FormActionType.DisarmRow, rowId: 'row-1' });
    expect(next).toBe(state);
  });

  it('DISARM_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: FormActionType.DisarmRow, rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_RECEIVED applies to a drawing row: done, metrics, uid, armedRowId cleared', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });

    expect(state.rows[0]).toMatchObject({
      status: RowStatus.Done,
      metrics,
      measurementUid: 'uid-1',
    });
    expect(state.armedRowId).toBeNull();
  });

  it('measurement for a pending row is ignored', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });
    expect(next).toBe(state);
  });

  it('measurement for a done row is ignored (no double-apply)', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });
    const next = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-2',
      metrics: { area: { value: 1, unit: 'px2' } },
      geometry: null,
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_RECEIVED with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'ghost',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_UPDATED replaces metrics of the matching done row', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });

    const updatedMetrics: Metrics = { area: { value: 200, unit: 'mm2' } };
    const next = reducer(state, {
      type: FormActionType.MeasurementUpdated,
      measurementUid: 'uid-1',
      metrics: updatedMetrics,
    });

    expect(next.rows[0]).toMatchObject({
      status: RowStatus.Done,
      metrics: updatedMetrics,
      measurementUid: 'uid-1',
    });
  });

  it('MEASUREMENT_UPDATED with an unknown measurementUid leaves state unchanged', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });

    const next = reducer(state, {
      type: FormActionType.MeasurementUpdated,
      measurementUid: 'ghost',
      metrics: { area: { value: 999, unit: 'mm2' } },
    });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_UPDATED for a pending row with the same uid leaves state unchanged', () => {
    // A row is only ever `pending` with a `measurementUid` in a contrived/defensive scenario
    // (normally uid is set exactly when status becomes `done`), but the reducer must still refuse
    // to update anything but a `done` row - checked directly by constructing that state.
    const state: FormState = {
      rows: [
        {
          rowId: 'row-1',
          status: RowStatus.Pending,
          toolName: 'EllipticalROI',
          metrics: null,
          measurementUid: 'uid-1',
          geometry: null,
          restoreFailureReason: null,
        },
      ],
      armedRowId: null,
    };

    const next = reducer(state, {
      type: FormActionType.MeasurementUpdated,
      measurementUid: 'uid-1',
      metrics,
    });
    expect(next).toBe(state);
  });

  it('REMOVE_ROW drops the row and clears armedRowId when it was the armed one', () => {
    let state = addRows(initialFormState, 'row-1', 'row-2');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, { type: FormActionType.RemoveRow, rowId: 'row-1' });

    expect(state.rows.map((row) => row.rowId)).toEqual(['row-2']);
    expect(state.armedRowId).toBeNull();
  });

  it('REMOVE_ROW with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: FormActionType.RemoveRow, rowId: 'ghost' });
    expect(next).toBe(state);
  });

  it('MEASUREMENT_CLEARED returns a done row to pending with metrics and uid cleared', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });

    const next = reducer(state, { type: FormActionType.MeasurementCleared, rowId: 'row-1' });

    expect(next.rows[0]).toMatchObject({
      status: RowStatus.Pending,
      metrics: null,
      measurementUid: null,
    });
  });

  it('MEASUREMENT_CLEARED for a non-done row leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, { type: FormActionType.MeasurementCleared, rowId: 'row-1' });
    expect(next).toBe(state);
  });

  it('ADD_ROW keeps the given toolName on the new row', () => {
    const state = reducer(initialFormState, {
      type: FormActionType.AddRow,
      rowId: 'row-1',
      toolName: 'Length',
    });
    expect(state.rows[0].toolName).toBe('Length');
  });

  it('a row keeps its own toolName through arm/measure/clear (re-arm uses the same tool)', () => {
    let state = reducer(initialFormState, {
      type: FormActionType.AddRow,
      rowId: 'row-1',
      toolName: 'Length',
    });
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics: { length: { value: 12, unit: 'mm' } },
      geometry: null,
    });
    state = reducer(state, { type: FormActionType.MeasurementCleared, rowId: 'row-1' });

    expect(state.rows[0].toolName).toBe('Length');
  });

  it('rows are unlimited: add 50 rows', () => {
    const rowIds = Array.from({ length: 50 }, (_, i) => `row-${String(i)}`);
    const state = addRows(initialFormState, ...rowIds);
    expect(state.rows).toHaveLength(50);
    expect(state.rows.every((row) => row.status === RowStatus.Pending)).toBe(true);
  });

  it('RESTORE_FAILED marks the row with the given reason and keeps its value', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, { type: FormActionType.ArmRow, rowId: 'row-1' });
    state = reducer(state, {
      type: FormActionType.MeasurementReceived,
      rowId: 'row-1',
      measurementUid: 'uid-1',
      metrics,
      geometry: null,
    });

    const next = reducer(state, {
      type: FormActionType.RestoreFailed,
      rowId: 'row-1',
      reason: 'invalid-geometry',
    });

    expect(next.rows[0]).toMatchObject({
      status: RowStatus.Done,
      metrics,
      restoreFailureReason: 'invalid-geometry',
    });
  });

  it('RESTORE_FAILED with an unknown rowId leaves state unchanged', () => {
    const state = addRows(initialFormState, 'row-1');
    const next = reducer(state, {
      type: FormActionType.RestoreFailed,
      rowId: 'ghost',
      reason: 'unknown-study',
    });
    expect(next).toBe(state);
  });

  it('RESTORE_FAILED twice with the same reason is a no-op the second time', () => {
    let state = addRows(initialFormState, 'row-1');
    state = reducer(state, {
      type: FormActionType.RestoreFailed,
      rowId: 'row-1',
      reason: 'viewer-error',
    });
    const next = reducer(state, {
      type: FormActionType.RestoreFailed,
      rowId: 'row-1',
      reason: 'viewer-error',
    });
    expect(next).toBe(state);
  });
});
