import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { OrchestratorListener, OrchestratorState } from './createOrchestrator.props';

export interface ListenerSet {
  subscribe: (listener: OrchestratorListener) => () => void;
  notify: (event: ViewerEvent | null, state: OrchestratorState) => void;
  clear: () => void;
}
