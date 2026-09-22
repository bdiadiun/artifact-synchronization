import type { Dispatch } from 'react';
import type {
  MeasurementGeometry,
  Metrics,
  RestoreFailureReason,
  ToolName,
} from '@bdiadiun/scoring-contract';
import type { HostChannel } from '@bdiadiun/scoring-channel';
// The two enums stay in `rows.ts`: an enum is a value, and these are imported here in type
// position only, so nothing is required at runtime in either direction.
import type { FormActionType, RowStatus } from './rows';

export interface Row {
  rowId: string;
  status: RowStatus;
  toolName: ToolName;
  metrics: Metrics | null;
  measurementUid: string | null;
  // A-14: kept so a restored row can be re-sent to the viewer; null until a measurement arrives.
  geometry: MeasurementGeometry | null;
  // A-14: null unless a RESTORE_MEASUREMENTS reply named this row as failed; the reason drives the
  // marker `MeasurementRow` shows next to a value that has no annotation behind it.
  restoreFailureReason: RestoreFailureReason | null;
}

// At most one row is `drawing` at a time (A-4), so the armed row is the drawing one and is not
// mirrored anywhere: `findDrawingRow` reads it off the rows.
export interface FormState {
  rows: Row[];
}

export type FormAction =
  | { type: FormActionType.AddRow; rowId: string; toolName: ToolName }
  | { type: FormActionType.ArmRow; rowId: string }
  | { type: FormActionType.DisarmRow; rowId: string }
  | {
      type: FormActionType.MeasurementReceived;
      rowId: string;
      measurementUid: string;
      metrics: Metrics;
      geometry: MeasurementGeometry | null;
    }
  | { type: FormActionType.MeasurementUpdated; measurementUid: string; metrics: Metrics }
  | { type: FormActionType.RemoveRow; rowId: string }
  | { type: FormActionType.MeasurementCleared; measurementUid: string }
  | { type: FormActionType.RestoreFailed; rowId: string; reason: RestoreFailureReason };

export type ActionOf<T extends FormActionType> = Extract<FormAction, { type: T }>;

// What a row action and a viewer-event handler are both given: the state they read, the dispatch
// they change it with and the channel they reach the viewer through. The channel is null until the
// mount effect has created it, before which nothing can be clicked.
export interface FormContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  channel: HostChannel | null;
}
