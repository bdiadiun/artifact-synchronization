import type { MeasurementGeometry, ToolName } from './vocabulary.props';

export interface ActivateToolCommand {
  type: 'ACTIVATE_TOOL';
  requestId: string;
  rowId: string;
  toolName: ToolName;
}

export interface DeactivateToolCommand {
  type: 'DEACTIVATE_TOOL';
  requestId: string;
  rowId: string;
}

export interface RemoveMeasurementCommand {
  type: 'REMOVE_MEASUREMENT';
  requestId: string;
  rowId: string;
  measurementUid: string;
}

export interface FocusMeasurementCommand {
  type: 'FOCUS_MEASUREMENT';
  requestId: string;
  rowId: string;
  measurementUid: string;
}

export interface RestoreMeasurementRequest {
  rowId: string;
  measurementUid: string;
  toolName: ToolName;
  geometry: MeasurementGeometry;
}

export interface RestoreMeasurementsCommand {
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
