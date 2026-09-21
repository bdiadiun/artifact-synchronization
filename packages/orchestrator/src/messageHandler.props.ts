import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { OrchestratorState } from './createOrchestrator.props';

export interface MessageHandlerDeps {
  viewerOrigin: string;
  getState: () => OrchestratorState;
  setState: (patch: Partial<OrchestratorState>) => void;
  notify: (event: ViewerEvent | null) => void;
  flushQueue: () => void;
}
