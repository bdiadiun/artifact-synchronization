import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { OrchestratorState } from './createOrchestrator.props';

export interface StateStore {
  get: () => OrchestratorState;
  patch: (patch: Partial<OrchestratorState>) => void;
  // Publishes the current state to every subscriber; `event` is null for a state-only change.
  notify: (event: ViewerEvent | null) => void;
}
