import type { MeasurementGeometry, Metrics, ViewerEvent } from '@bdiadiun/scoring-contract';
import type { Disposable, PayloadOf, ViewerChannel } from '@bdiadiun/scoring-channel';

export interface MeasurementUpdate {
  toolName: string;
  metrics: Metrics;
  geometry?: MeasurementGeometry;
}

export type AddedPayload = PayloadOf<ViewerEvent, 'MEASUREMENT_ADDED'>;

export interface ReportedMeasurementsDeps {
  send: ViewerChannel['send'];
}

export interface ReportedMeasurements extends Disposable {
  isReported: (uid: string) => boolean;
  isBoundToRow: (uid: string) => boolean;
  wasLastSent: (uid: string, metrics: Metrics) => boolean;
  // Sends the event and records what it said; false when the host could not be reached.
  reportAdded: (payload: AddedPayload) => boolean;
  // Sends the removal with the cause it was told to expect, and forgets the measurement.
  reportRemoved: (uid: string) => void;
  // A-10: the next removal of this uid is one the host asked for, and the event must say so.
  expectRemoval: (uid: string, requestId: string) => void;
  bindRow: (uid: string, rowId: string) => void;
  pushUpdate: (uid: string, update: MeasurementUpdate) => void;
  forget: (uid: string) => void;
}
