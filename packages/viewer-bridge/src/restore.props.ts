import type { RestoreMeasurementsCommand } from '@bdiadiun/scoring-contract';
import type { Disposable } from '@bdiadiun/scoring-channel';
import type { OhifServicesManager } from './ohif.props.js';
import type { PostToHost } from './messaging.props.js';
import type { ReportedMeasurements } from './reportedMeasurements.props.js';

export interface RestoreCommandsDeps {
  servicesManager: OhifServicesManager;
  reported: ReportedMeasurements;
  post: PostToHost;
}

export interface RestoreCommands extends Disposable {
  handleRestore: (command: RestoreMeasurementsCommand) => void;
}

export interface ReadinessGate extends Disposable {
  whenReady: (run: () => void) => void;
}
