import type { RestoreMeasurementsCommand } from '@bdiadiun/scoring-contract';
import type { OhifServicesManager } from './ohif.props.js';
import type { PostToHost } from './messaging.props.js';
import type { ReportedMeasurements } from './reportedMeasurements.props.js';

export interface RestoreCommandsDeps {
  servicesManager: OhifServicesManager;
  reported: ReportedMeasurements;
  post: PostToHost;
}

export interface RestoreCommands {
  handleRestore: (command: RestoreMeasurementsCommand) => void;
  dispose: () => void;
}

export interface ReadinessGate {
  whenReady: (run: () => void) => void;
  dispose: () => void;
}
