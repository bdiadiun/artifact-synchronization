import type { RemoveMeasurementCommand } from '@bdiadiun/scoring-contract';
import type { OhifServicesManager } from './ohif.props.js';
import type { PostToHost } from './messaging.props.js';

export interface RemovalCommandsDeps {
  servicesManager: OhifServicesManager;
  post: PostToHost;
  forget: (uid: string) => void;
}

export interface RemovalCommands {
  handleRemove: (command: RemoveMeasurementCommand) => void;
  takeCause: (uid: string) => string | undefined;
  dispose: () => void;
}
