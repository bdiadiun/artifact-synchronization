import type { Metrics } from '@bdiadiun/scoring-contract';
import type { OhifMeasurementService, OhifServicesManager } from './ohif.props.js';
import type { ArmedState } from './commands.props.js';
import type { DisarmReason } from './commands.js';
import type { OhifMeasurementLike } from './measurements.props.js';
import type { PostToHost } from './messaging.props.js';
import type { ReportedMeasurements } from './reportedMeasurements.props.js';

export interface MeasurementStreamDeps {
  servicesManager: OhifServicesManager;
  post: PostToHost;
  reported: ReportedMeasurements;
  getArmed: () => ArmedState | null;
  disarm: (reason: DisarmReason) => void;
  takeCause: (uid: string) => string | undefined;
}

export interface MeasurementStream {
  dispose: () => void;
}

export interface AddedCorrection {
  schedule: (uid: string) => void;
  dispose: () => void;
}

export interface AddedCorrectionDeps {
  measurementService: OhifMeasurementService;
  reported: ReportedMeasurements;
}

export interface AddedEventParts {
  uid: string;
  toolName: string;
  metrics: Metrics;
  measurement: OhifMeasurementLike;
  armed: ArmedState | null;
}
