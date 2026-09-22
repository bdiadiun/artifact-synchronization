import type { Disposable } from '@bdiadiun/scoring-channel';
import type { OhifMeasurementService, OhifServicesManager } from './ohif.props.js';
import type { ToolCommands } from './commands.props.js';
import type { ReportedMeasurements } from './reportedMeasurements.props.js';

export interface MeasurementStreamDeps {
  servicesManager: OhifServicesManager;
  // Owns both what has been reported and the way out; the stream only decides when to report.
  reported: ReportedMeasurements;
  // The armed row a new measurement belongs to, and the way to release it (C-4.3.6); passed whole
  // rather than as its two members.
  armed: Pick<ToolCommands, 'getArmed' | 'disarm'>;
}

export type MeasurementStream = Disposable;

export interface AddedCorrection extends Disposable {
  schedule: (uid: string) => void;
}

export interface AddedCorrectionDeps {
  measurementService: OhifMeasurementService;
  reported: ReportedMeasurements;
}
