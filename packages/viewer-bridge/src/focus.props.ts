import type { FocusMeasurementCommand } from '@bdiadiun/scoring-contract';
import type { OhifServicesManager } from './ohif.props.js';

export interface FocusCommandsDeps {
  servicesManager: OhifServicesManager;
}

export interface FocusCommands {
  handleFocus: (command: FocusMeasurementCommand) => void;
}
