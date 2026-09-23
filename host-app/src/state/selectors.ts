import type { Row } from '@app/models/row';

export const findRow = (rows: readonly Row[], rowId: string): Row | undefined =>
  rows.find((row) => row.rowId === rowId);

export const findRowByUid = (rows: readonly Row[], measurementUid: string): Row | undefined =>
  rows.find((row) => row.measurementUid === measurementUid);
