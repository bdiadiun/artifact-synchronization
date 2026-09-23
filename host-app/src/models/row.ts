import { z } from 'zod';
import {
  MeasurementGeometry,
  Metrics,
  RestoreFailureReason,
  ToolName,
  type RestoreMeasurementRequest,
} from '@bdiadiun/scoring-contract';

export enum RowStatus {
  Pending = 'pending',
  Drawing = 'drawing',
  Done = 'done',
}

const schema = z.object({
  rowId: z.string().min(1),
  status: z.enum(RowStatus),
  toolName: ToolName,
  metrics: Metrics.nullable(),
  measurementUid: z.string().min(1).nullable(),
  geometry: MeasurementGeometry.nullable(),
  restoreFailureReason: RestoreFailureReason.nullable(),
});
export type Row = z.infer<typeof schema>;

const jsonSchema = schema.omit({ restoreFailureReason: true });
export type RowJson = z.infer<typeof jsonSchema>;

const create = (toolName: ToolName): Row => ({
  rowId: crypto.randomUUID(),
  status: RowStatus.Pending,
  toolName,
  metrics: null,
  measurementUid: null,
  geometry: null,
  restoreFailureReason: null,
});

const toJSON = ({ restoreFailureReason: _restoreFailureReason, ...row }: Row): RowJson => row;

const fromJSON = (row: RowJson): Row => ({ ...row, restoreFailureReason: null });

const toRestoreRequest = (row: Row): RestoreMeasurementRequest | null =>
  row.measurementUid !== null && row.geometry !== null
    ? { rowId: row.rowId, measurementUid: row.measurementUid, toolName: row.toolName, geometry: row.geometry }
    : null;

export const RowModel = { jsonSchema, create, toJSON, fromJSON, toRestoreRequest };
