import type { RestoreMeasurementsCommand } from '@bdiadiun/scoring-contract';
import type { Disposable, ViewerChannel } from '@bdiadiun/scoring-channel';
import type { OhifServicesManager } from './ohif.props.js';
import type { ReportedMeasurements } from './reportedMeasurements.props.js';

export interface RestoreCommandsDeps {
  servicesManager: OhifServicesManager;
  reported: ReportedMeasurements;
  send: ViewerChannel['send'];
}

export interface RestoreCommands extends Disposable {
  handleRestore: (command: RestoreMeasurementsCommand) => void;
}

export interface ReadinessGate extends Disposable {
  whenReady: (run: () => void) => void;
}
