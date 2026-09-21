import type { OhifCommandsManager, OhifServicesManager } from './ohif.props.js';

export type Unsubscribe = () => void;

export interface BridgeDeps {
  servicesManager: OhifServicesManager;
  commandsManager: OhifCommandsManager;
  hostOrigin: string;
}

export interface Bridge {
  dispose: Unsubscribe;
  getArmedRowId: () => string | null;
}
