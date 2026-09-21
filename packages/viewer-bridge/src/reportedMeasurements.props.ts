import type { MeasurementGeometry, Metrics } from '@bdiadiun/scoring-contract';
import type { PostToHost } from './messaging.props.js';

export interface MeasurementUpdate {
  toolName: string;
  metrics: Metrics;
  geometry?: MeasurementGeometry;
}

export interface ReportedMeasurementsDeps {
  post: PostToHost;
}

export interface ReportedMeasurements {
  isReported: (uid: string) => boolean;
  isBoundToRow: (uid: string) => boolean;
  wasLastSent: (uid: string, metrics: Metrics) => boolean;
  recordAdded: (uid: string, rowId: string | null, metrics: Metrics) => void;
  bindRow: (uid: string, rowId: string) => void;
  pushUpdate: (uid: string, update: MeasurementUpdate) => void;
  forget: (uid: string) => void;
  dispose: () => void;
}
