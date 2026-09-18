// Named lookups over the row list (CONVENTIONS §5), shared by the reducer and the form hooks.

import type { Row } from '../form/rows';

export const findRow = (rows: readonly Row[], rowId: string): Row | undefined =>
  rows.find((row) => row.rowId === rowId);

// A-8: the viewer owns measurement ids, so an incoming event is matched by uid, not by row id.
export const findRowByUid = (rows: readonly Row[], measurementUid: string): Row | undefined =>
  rows.find((row) => row.measurementUid === measurementUid);

export const hasRow = (rows: readonly Row[], rowId: string): boolean =>
  findRow(rows, rowId) !== undefined;
