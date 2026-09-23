import { z } from 'zod';
import type { HostCommand } from './hostCommands.js';
import { MeasurementGeometry, Metrics } from './vocabulary.js';

export const ViewerReadyEvent = z.object({
  type: z.literal('VIEWER_READY'),
  viewerVersion: z.string(),
});
export type ViewerReadyEvent = z.infer<typeof ViewerReadyEvent>;

export const MeasurementAddedEvent = z.object({
  type: z.literal('MEASUREMENT_ADDED'),
  rowId: z.string().min(1).nullable(),
  measurementUid: z.string().min(1),
  toolName: z.string(),
  metrics: Metrics,
  geometry: MeasurementGeometry.optional(),
});
export type MeasurementAddedEvent = z.infer<typeof MeasurementAddedEvent>;

export const MeasurementUpdatedEvent = z.object({
  type: z.literal('MEASUREMENT_UPDATED'),
  measurementUid: z.string().min(1),
  toolName: z.string(),
  metrics: Metrics,
  geometry: MeasurementGeometry.optional(),
});
export type MeasurementUpdatedEvent = z.infer<typeof MeasurementUpdatedEvent>;

export const MeasurementRemovedEvent = z.object({
  type: z.literal('MEASUREMENT_REMOVED'),
  measurementUid: z.string().min(1),
});
export type MeasurementRemovedEvent = z.infer<typeof MeasurementRemovedEvent>;

export const RestoreFailureReason = z.enum(['already-present', 'unknown-study', 'viewer-error']);
export type RestoreFailureReason = z.infer<typeof RestoreFailureReason>;

export const RestoreFailure = z.object({
  rowId: z.string().min(1),
  reason: RestoreFailureReason,
});
export type RestoreFailure = z.infer<typeof RestoreFailure>;

export const MeasurementsRestoredEvent = z.object({
  type: z.literal('MEASUREMENTS_RESTORED'),
  restored: z.array(z.string().min(1)),
  failed: z.array(RestoreFailure),
});
export type MeasurementsRestoredEvent = z.infer<typeof MeasurementsRestoredEvent>;

export const ViewerEvent = z.discriminatedUnion('type', [
  ViewerReadyEvent,
  MeasurementAddedEvent,
  MeasurementUpdatedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
]);
export type ViewerEvent = z.infer<typeof ViewerEvent>;

export const isViewerEvent = (value: unknown): value is ViewerEvent =>
  ViewerEvent.safeParse(value).success;

export type BridgeMessage = HostCommand | ViewerEvent;
