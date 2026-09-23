import { RowStatus, type Row } from './reducer';

export const findRow = (rows: readonly Row[], rowId: string): Row | undefined =>
  rows.find((row) => row.rowId === rowId);

// A-8: the viewer owns measurement ids, so an incoming event is matched by uid, not by row id.
export const findRowByUid = (rows: readonly Row[], measurementUid: string): Row | undefined =>
  rows.find((row) => row.measurementUid === measurementUid);

// At most one row is `drawing` at a time (A-4), so the armed row is the drawing one and is not
// mirrored anywhere: it is read off the rows.
export const findDrawingRow = (rows: readonly Row[]): Row | undefined =>
  rows.find((row) => row.status === RowStatus.Drawing);
