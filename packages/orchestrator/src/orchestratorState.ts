// The orchestrator's state and the one way it reaches subscribers. Kept apart from the factory so
// that every state change goes through the same two calls.

import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { OrchestratorState } from './createOrchestrator.props';
import type { ListenerSet } from './listeners.props';
import type { StateStore } from './orchestratorState.props';

export type { StateStore } from './orchestratorState.props';

const INITIAL_STATE: OrchestratorState = {
  ready: false,
  queued: 0,
  lastEvent: null,
  ignoredOrigins: 0,
};

export const createStateStore = (listeners: ListenerSet): StateStore => {
  let state: OrchestratorState = INITIAL_STATE;

  return {
    get: (): OrchestratorState => state,
    patch: (patch: Partial<OrchestratorState>): void => {
      state = { ...state, ...patch };
    },
    notify: (event: ViewerEvent | null): void => {
      listeners.notify(event, state);
    },
  };
};
