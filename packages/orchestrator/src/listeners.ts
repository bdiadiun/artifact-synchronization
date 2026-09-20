// The orchestrator's subscriber set. Kept apart from `createOrchestrator` so the factory only
// wires; adding or removing a listener never touches orchestrator state.

import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { OrchestratorListener, OrchestratorState } from './createOrchestrator';

export interface ListenerSet {
  subscribe: (listener: OrchestratorListener) => () => void;
  notify: (event: ViewerEvent | null, state: OrchestratorState) => void;
  clear: () => void;
}

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
