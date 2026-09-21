// The orchestrator's state and the one way it reaches subscribers. Kept apart from the factory so
// that every state change goes through the same two calls and adding or removing a listener never
// touches state.

import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { OrchestratorListener, OrchestratorState } from './createOrchestrator.props';

export interface ListenerSet {
  subscribe: (listener: OrchestratorListener) => () => void;
  notify: (event: ViewerEvent | null, state: OrchestratorState) => void;
  clear: () => void;
}

export interface StateStore {
  get: () => OrchestratorState;
  patch: (patch: Partial<OrchestratorState>) => void;
  // Publishes the current state to every subscriber; `event` is null for a state-only change.
  notify: (event: ViewerEvent | null) => void;
}

export const INITIAL_ORCHESTRATOR_STATE: OrchestratorState = {
  ready: false,
  queued: 0,
  lastEvent: null,
};

export const createListenerSet = (): ListenerSet => {
  const listeners = new Set<OrchestratorListener>();

  return {
    subscribe: (listener: OrchestratorListener): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify: (event: ViewerEvent | null, state: OrchestratorState): void => {
      for (const listener of listeners) {
        listener(event, state);
      }
    },
    clear: (): void => {
      listeners.clear();
    },
  };
};

export const createStateStore = (listeners: ListenerSet): StateStore => {
  let state: OrchestratorState = INITIAL_ORCHESTRATOR_STATE;

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
