import type { HostCommand } from '@bdiadiun/scoring-contract';
import { INITIAL_CHANNEL_STATE } from './channelState.js';
import type { ChannelState } from './channelState.js';
import { postTo } from './peer.js';
import type { Peer } from './peer.js';

export interface HostOutbox {
  send: (type: HostCommand['type'], payload: object, requestId: string) => boolean;
  flush: () => void;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
}

export const createHostOutbox = (peer: Peer): HostOutbox => {
  const queued: HostCommand[] = [];
  const listeners = new Set<() => void>();
  let state = INITIAL_CHANNEL_STATE;

  const publish = (ready: boolean): void => {
    if (ready === state.ready && queued.length === state.queued) {
      return;
    }
    state = { ready, queued: queued.length };
    for (const listener of listeners) {
      listener();
    }
  };

  const send = (type: HostCommand['type'], payload: object, requestId: string): boolean => {
    const command = { type, requestId, ...payload } as HostCommand;

    if (state.ready && postTo(peer, command)) {
      return true;
    }
    queued.push(command);
    publish(state.ready);
    return false;
  };

  const flush = (): void => {
    while (queued.length > 0 && postTo(peer, queued[0])) {
      queued.shift();
    }
    publish(true);
  };

  const getState = (): ChannelState => state;

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const clear = (): void => {
    queued.length = 0;
    listeners.clear();
    state = INITIAL_CHANNEL_STATE;
  };

  return { send, flush, getState, subscribe, clear };
};
