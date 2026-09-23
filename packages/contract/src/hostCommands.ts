import { z } from 'zod';
import { MeasurementGeometry, ToolName } from './vocabulary.js';

export const ActivateToolCommand = z.object({
  type: z.literal('ACTIVATE_TOOL'),
  rowId: z.string().min(1),
  toolName: ToolName,
});
export type ActivateToolCommand = z.infer<typeof ActivateToolCommand>;

export const DeactivateToolCommand = z.object({
  type: z.literal('DEACTIVATE_TOOL'),
  rowId: z.string().min(1),
});
export type DeactivateToolCommand = z.infer<typeof DeactivateToolCommand>;

export const RemoveMeasurementCommand = z.object({
  type: z.literal('REMOVE_MEASUREMENT'),
  measurementUid: z.string().min(1),
});
export type RemoveMeasurementCommand = z.infer<typeof RemoveMeasurementCommand>;

export const FocusMeasurementCommand = z.object({
  type: z.literal('FOCUS_MEASUREMENT'),
  measurementUid: z.string().min(1),
});
export type FocusMeasurementCommand = z.infer<typeof FocusMeasurementCommand>;

export const RestoreMeasurementRequest = z.object({
  rowId: z.string().min(1),
  measurementUid: z.string().min(1),
  toolName: ToolName,
  geometry: MeasurementGeometry,
});
export type RestoreMeasurementRequest = z.infer<typeof RestoreMeasurementRequest>;

export const RestoreMeasurementsCommand = z.object({
  type: z.literal('RESTORE_MEASUREMENTS'),
  studyInstanceUid: z.string().min(1),
  measurements: z.array(RestoreMeasurementRequest),
});
export type RestoreMeasurementsCommand = z.infer<typeof RestoreMeasurementsCommand>;

export const HostCommand = z.discriminatedUnion('type', [
  ActivateToolCommand,
  DeactivateToolCommand,
  RemoveMeasurementCommand,
  FocusMeasurementCommand,
  RestoreMeasurementsCommand,
]);
export type HostCommand = z.infer<typeof HostCommand>;

export const isHostCommand = (value: unknown): value is HostCommand => HostCommand.safeParse(value).success;
