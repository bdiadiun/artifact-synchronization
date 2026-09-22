import type { HostCommand } from './hostCommands.props';
import type { MeasurementGeometry, Metrics } from './vocabulary.props';
// Type-only import of the tuple the guard tests against, so the reasons are listed once.
import type { RESTORE_FAILURE_REASON_VALUES } from './viewerEvents';

export interface ViewerReadyEvent {
  version: 1;
  type: 'VIEWER_READY';
  viewerVersion: string;
}

export interface MeasurementAddedEvent {
  version: 1;
  type: 'MEASUREMENT_ADDED';
  // null when drawn without an ACTIVATE_TOOL command (e.g. from the OHIF toolbar).
  rowId: string | null;
  measurementUid: string;
  toolName: string;
  metrics: Metrics;
  // requestId of the command that caused this event, for echo-loop protection (A-10).
  causedBy?: string;
  // Present so the form can persist enough to rebuild the annotation later (A-14).
  geometry?: MeasurementGeometry;
}

export interface MeasurementUpdatedEvent {
  version: 1;
  type: 'MEASUREMENT_UPDATED';
  measurementUid: string;
  toolName: string;
  metrics: Metrics;
  causedBy?: string;
  geometry?: MeasurementGeometry;
}

export interface MeasurementRemovedEvent {
  version: 1;
  type: 'MEASUREMENT_REMOVED';
  measurementUid: string;
  // Absent when the deletion originated in the viewer, which is the case the host needs to
  // hear about to clear the matching row (S-5.2, A-10).
  causedBy?: string;
}

// Reason a single row's restore failed (A-14); string literals so the form can render a
// per-row explanation without a lookup table.
export type RestoreFailureReason = (typeof RESTORE_FAILURE_REASON_VALUES)[number];

export interface RestoreFailure {
  rowId: string;
  reason: RestoreFailureReason;
}

export interface MeasurementsRestoredEvent {
  version: 1;
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
