// Pure, side-effect-free reducer over the rows; `hooks/useScoringForm.ts` wires it to the channel.

import { z } from 'zod';
import { findRow, findRowByUid } from './selectors';
import {
  MeasurementGeometry,
  Metrics,
  RestoreFailureReason,
  ToolName,
  type MeasurementAddedEvent,
  type MeasurementRemovedEvent,
  type MeasurementsRestoredEvent,
  type MeasurementUpdatedEvent,
  type ViewerEvent,
} from '@bdiadiun/scoring-contract';

export enum RowStatus {
  Pending = 'pending',
  Drawing = 'drawing',
  Done = 'done',
}

// A-14: `geometry` is kept so a restored row can be re-sent to the viewer, and
// `restoreFailureReason` marks a row the viewer refused, which `MeasurementRow` shows next to a
// value that has no annotation behind it.
export const Row = z.object({
  rowId: z.string().min(1),
  status: z.enum(RowStatus),
  toolName: ToolName,
  metrics: Metrics.nullable(),
  measurementUid: z.string().min(1).nullable(),
  geometry: MeasurementGeometry.nullable(),
  restoreFailureReason: RestoreFailureReason.nullable(),
});
export type Row = z.infer<typeof Row>;

// What changes the rows: the four things a button does, and every event the viewer sends — the
// wire events are dispatched as they are, so this reducer is the one place that says what an
// event means for the form.
export type FormAction =
  | { type: 'ADD_ROW'; rowId: string; toolName: ToolName }
  | { type: 'ARM_ROW'; rowId: string }
  | { type: 'DISARM_ROW'; rowId: string }
  | { type: 'REMOVE_ROW'; rowId: string }
  | ViewerEvent;

type ActionOf<T extends FormAction['type']> = Extract<FormAction, { type: T }>;

const replaceRow = (rows: Row[], rowId: string, patch: Partial<Row>): Row[] =>
  rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row));

const addRow = (rows: Row[], action: ActionOf<'ADD_ROW'>): Row[] => [
  ...rows,
  {
    rowId: action.rowId,
    status: RowStatus.Pending,
    toolName: action.toolName,
    metrics: null,
    measurementUid: null,
    geometry: null,
    restoreFailureReason: null,
  },
];

// Only one row is armed at a time (A-4): the target starts drawing, any other drawing row goes
// back to pending. Arming the row that already draws changes nothing.
const armRow = (rows: Row[], action: ActionOf<'ARM_ROW'>): Row[] => {
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

const disarmRow = (rows: Row[], action: ActionOf<'DISARM_ROW'>): Row[] =>
  findRow(rows, action.rowId)?.status === RowStatus.Drawing
    ? replaceRow(rows, action.rowId, { status: RowStatus.Pending })
    : rows;

const removeRow = (rows: Row[], action: ActionOf<'REMOVE_ROW'>): Row[] =>
  findRow(rows, action.rowId) === undefined
    ? rows
    : rows.filter((row) => row.rowId !== action.rowId);

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
  });
};

const updateMeasurement = (rows: Row[], event: MeasurementUpdatedEvent): Row[] => {
  const target = findRowByUid(rows, event.measurementUid);
  return target?.status === RowStatus.Done
    ? replaceRow(rows, target.rowId, { metrics: event.metrics })
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
      })
    : rows;
};

// A-14: a row the viewer refused to restore is marked, so the form can say the value has no
// annotation behind it any more.
const markRestoreFailures = (rows: Row[], event: MeasurementsRestoredEvent): Row[] =>
  event.failed.reduce((current, failure) => {
    const target = findRow(current, failure.rowId);
    if (target === undefined || target.restoreFailureReason === failure.reason) {
      return current;
    }
    return replaceRow(current, failure.rowId, { restoreFailureReason: failure.reason });
  }, rows);

export const reducer = (rows: Row[], action: FormAction): Row[] => {
  switch (action.type) {
    case 'ADD_ROW':
      return addRow(rows, action);
    case 'ARM_ROW':
      return armRow(rows, action);
    case 'DISARM_ROW':
      return disarmRow(rows, action);
    case 'REMOVE_ROW':
      return removeRow(rows, action);
    case 'MEASUREMENT_ADDED':
      return receiveMeasurement(rows, action);
    case 'MEASUREMENT_UPDATED':
      return updateMeasurement(rows, action);
    case 'MEASUREMENT_REMOVED':
      return clearMeasurement(rows, action);
    case 'MEASUREMENTS_RESTORED':
      return markRestoreFailures(rows, action);
    case 'VIEWER_READY':
      return rows;
  }
};
