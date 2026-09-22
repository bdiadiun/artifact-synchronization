import type { HostCommand } from './hostCommands.props';
import type { MeasurementGeometry, Metrics } from './vocabulary.props';
import type { RESTORE_FAILURE_REASON_VALUES } from './viewerEvents';

export interface ViewerReadyEvent {
  type: 'VIEWER_READY';
  viewerVersion: string;
}

export interface MeasurementAddedEvent {
  type: 'MEASUREMENT_ADDED';
  rowId: string | null;
  measurementUid: string;
  toolName: string;
  metrics: Metrics;
  causedBy?: string;
  geometry?: MeasurementGeometry;
}

export interface MeasurementUpdatedEvent {
  type: 'MEASUREMENT_UPDATED';
  measurementUid: string;
  toolName: string;
  metrics: Metrics;
  causedBy?: string;
  geometry?: MeasurementGeometry;
}

export interface MeasurementRemovedEvent {
  type: 'MEASUREMENT_REMOVED';
  measurementUid: string;
  causedBy?: string;
}

export type RestoreFailureReason = (typeof RESTORE_FAILURE_REASON_VALUES)[number];

export interface RestoreFailure {
  rowId: string;
  reason: RestoreFailureReason;
}

export interface MeasurementsRestoredEvent {
  type: 'MEASUREMENTS_RESTORED';
  causedBy?: string;
  restored: string[];
  failed: RestoreFailure[];
}

export type ViewerEvent =
  | ViewerReadyEvent
  | MeasurementAddedEvent
  | MeasurementUpdatedEvent
  | MeasurementRemovedEvent
  | MeasurementsRestoredEvent;

export type BridgeMessage = HostCommand | ViewerEvent;
