// Pure, side-effect-free reducer over the rows; `hooks/useScoringForm.ts` wires it to the channel.

import type {
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import { RowStatus, type Row } from '@app/models/row';
import { findRow, findRowByUid } from './selectors';

// What changes the rows: the two local actions, every command the form sends and every event the
// viewer sends — commands and events go through as they are, so this reducer is the one place that
// says what each of them means for the form.
export type FormAction =
  { type: 'ADD_ROW'; row: Row } | { type: 'REMOVE_ROW'; rowId: string } | HostCommand | ViewerEvent;

type ActionOf<T extends FormAction['type']> = Extract<FormAction, { type: T }>;

const replaceRow = (rows: Row[], rowId: string, patch: Partial<Row>): Row[] =>
  rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row));

const addRow = (rows: Row[], action: ActionOf<'ADD_ROW'>): Row[] => [...rows, action.row];

// Only one row is armed at a time (A-4): the target starts drawing, any other drawing row goes
// back to pending. Arming the row that already draws changes nothing.
const armRow = (rows: Row[], action: ActionOf<'ACTIVATE_TOOL'>): Row[] => {
  const target = findRow(rows, action.rowId);
  if (target === undefined || target.status === RowStatus.Drawing) {
    return rows;
  }
  return rows.map((row) => {
    if (row.rowId === action.rowId) {
      return { ...row, status: RowStatus.Drawing };
    }
    return row.status === RowStatus.Drawing ? { ...row, status: RowStatus.Pending } : row;
  });
};

const disarmRow = (rows: Row[], action: ActionOf<'DEACTIVATE_TOOL'>): Row[] =>
  findRow(rows, action.rowId)?.status === RowStatus.Drawing
    ? replaceRow(rows, action.rowId, { status: RowStatus.Pending })
    : rows;

const removeRow = (rows: Row[], action: ActionOf<'REMOVE_ROW'>): Row[] =>
  findRow(rows, action.rowId) === undefined ? rows : rows.filter((row) => row.rowId !== action.rowId);

// A-8: a measurement drawn while nothing was armed arrives with `rowId: null` and changes nothing.
const receiveMeasurement = (rows: Row[], event: MeasurementAddedEvent): Row[] => {
  const target = event.rowId === null ? undefined : findRow(rows, event.rowId);
  if (target?.status !== RowStatus.Drawing) {
    return rows;
  }
  return replaceRow(rows, target.rowId, {
    status: RowStatus.Done,
    metrics: event.metrics,
    measurementUid: event.measurementUid,
    geometry: event.geometry ?? null,
    restoreFailureReason: null,
  });
};

const updateMeasurement = (rows: Row[], event: MeasurementUpdatedEvent): Row[] => {
  const target = findRowByUid(rows, event.measurementUid);
  return target?.status === RowStatus.Done
    ? replaceRow(rows, target.rowId, {
        metrics: event.metrics,
        geometry: event.geometry ?? target.geometry,
      })
    : rows;
};

// A deletion in the viewer "clears" the row back to pending rather than removing it (the
// assignment's wording); the viewer names the uid and the row is looked up here (A-8). The echo of
// a removal the form asked for finds no row and changes nothing (A-30).
const clearMeasurement = (rows: Row[], event: MeasurementRemovedEvent): Row[] => {
  const target = findRowByUid(rows, event.measurementUid);
  return target?.status === RowStatus.Done
    ? replaceRow(rows, target.rowId, {
        status: RowStatus.Pending,
        metrics: null,
        measurementUid: null,
        restoreFailureReason: null,
      })
    : rows;
};

// A-14: the viewer's answer to a restore, row by row — a row it rebuilt loses its mark, a row it
// refused keeps one, so the form can say the value has no annotation behind it any more.
const markRestoreOutcome = (rows: Row[], event: MeasurementsRestoredEvent): Row[] => {
  const outcomes = [...event.restored.map((rowId) => ({ rowId, reason: null })), ...event.failed];

  return outcomes.reduce((current, { rowId, reason }) => {
    const target = findRow(current, rowId);
    return target === undefined || target.restoreFailureReason === reason
      ? current
      : replaceRow(current, rowId, { restoreFailureReason: reason });
  }, rows);
};

export const reducer = (rows: Row[], action: FormAction): Row[] => {
  switch (action.type) {
    case 'ADD_ROW':
      return addRow(rows, action);
    case 'REMOVE_ROW':
      return removeRow(rows, action);
    case 'ACTIVATE_TOOL':
      return armRow(rows, action);
    case 'DEACTIVATE_TOOL':
      return disarmRow(rows, action);
    case 'MEASUREMENT_ADDED':
      return receiveMeasurement(rows, action);
    case 'MEASUREMENT_UPDATED':
      return updateMeasurement(rows, action);
    case 'MEASUREMENT_REMOVED':
      return clearMeasurement(rows, action);
    case 'MEASUREMENTS_RESTORED':
      return markRestoreOutcome(rows, action);
    case 'REMOVE_MEASUREMENT':
    case 'FOCUS_MEASUREMENT':
    case 'RESTORE_MEASUREMENTS':
    case 'VIEWER_READY':
      return rows;
  }
};
