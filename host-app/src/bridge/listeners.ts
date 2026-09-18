// The bridge's subscriber set. Kept apart from `createBridge` so the factory only wires; adding
// or removing a listener never touches bridge state.

import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { BridgeListener, BridgeState } from './createBridge';

export interface ListenerSet {
  subscribe: (listener: BridgeListener) => () => void;
  notify: (event: ViewerEvent | null, state: BridgeState) => void;
  clear: () => void;
}

export const createListenerSet = (): ListenerSet => {
  const listeners = new Set<BridgeListener>();

  return {
    subscribe: (listener: BridgeListener): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify: (event: ViewerEvent | null, state: BridgeState): void => {
      for (const listener of listeners) {
        listener(event, state);
      }
    },
    clear: (): void => {
      listeners.clear();
    },
  };
};
