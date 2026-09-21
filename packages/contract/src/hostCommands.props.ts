import type { MeasurementGeometry, ToolName } from './vocabulary.props';

export interface ActivateToolCommand {
  version: 1;
  type: 'ACTIVATE_TOOL';
  requestId: string;
  rowId: string;
  toolName: ToolName;
}

export interface DeactivateToolCommand {
  version: 1;
  type: 'DEACTIVATE_TOOL';
  requestId: string;
  rowId: string;
}

export interface RemoveMeasurementCommand {
  version: 1;
  type: 'REMOVE_MEASUREMENT';
  requestId: string;
  rowId: string;
  measurementUid: string;
}

export interface FocusMeasurementCommand {
  version: 1;
  type: 'FOCUS_MEASUREMENT';
  requestId: string;
  rowId: string;
  measurementUid: string;
}

// One row's worth of what the viewer needs to re-add an annotation on restore (A-14).
export interface RestoreMeasurementRequest {
  rowId: string;
  measurementUid: string;
  toolName: ToolName;
  geometry: MeasurementGeometry;
}

export interface RestoreMeasurementsCommand {
  version: 1;
  type: 'RESTORE_MEASUREMENTS';
  requestId: string;
  studyInstanceUid: string;
  measurements: RestoreMeasurementRequest[];
}

export type HostCommand =
  | ActivateToolCommand
  | DeactivateToolCommand
  | RemoveMeasurementCommand
  | FocusMeasurementCommand
  | RestoreMeasurementsCommand;
