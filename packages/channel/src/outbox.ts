// The way out: the one place that posts to the peer window with an explicit target origin (Q-2),
// holds messages back until that peer says it is ready (Q-1, A-9), and publishes both facts.

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { LOG_PREFIX } from './config.js';
import type { ChannelState, Peer } from './createChannel.props.js';

export interface Outbox<TOutgoing extends BridgeMessage> {
  send: (message: TOutgoing) => boolean;
  open: () => void;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
}

export const INITIAL_CHANNEL_STATE: ChannelState = { ready: false, queued: 0 };

const OPEN_CHANNEL_STATE: ChannelState = { ready: true, queued: 0 };

export const createOutbox = <TOutgoing extends BridgeMessage>(
  peer: Peer,
  held: boolean,
): Outbox<TOutgoing> => {
  const queue: TOutgoing[] = [];
  const listeners = new Set<() => void>();
  let state = held ? INITIAL_CHANNEL_STATE : OPEN_CHANNEL_STATE;

  const publish = (ready: boolean): void => {
    // Replaced only when a value changed, so a subscriber may compare states by identity.
    if (ready === state.ready && queue.length === state.queued) {
      return;
    }
    state = { ready, queued: queue.length };
    for (const listener of listeners) {
      listener();
    }
  };

  const post = (message: TOutgoing): boolean => {
    const peerWindow = peer.getWindow();

    if (peerWindow === null) {
      console.debug(`${LOG_PREFIX} no peer window -> ${message.type} not delivered`);
      return false;
    }

    // Never '*': the target origin is always the configured peer origin (Q-2).
    peerWindow.postMessage(message, peer.origin);
    return true;
  };

  return {
    send: (message: TOutgoing): boolean => {
      if (state.ready && post(message)) {
        return true;
      }

      // An end that never holds messages has nowhere to put one: the viewer drops what it cannot
      // deliver rather than growing a queue no handshake will ever flush.
      if (!held) {
        return false;
      }

      // Kept and flushed in call order, with no coalescing (A-9).
      queue.push(message);
      publish(state.ready);
      return false;
    },

    open: (): void => {
      // Checked per message: if the peer window disappears mid-flush, the remainder stays queued
      // instead of being dropped (Q-1).
      while (queue.length > 0 && post(queue[0])) {
        queue.shift();
      }
      publish(true);
    },

    getState: (): ChannelState => state,

    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear: (): void => {
      queue.length = 0;
      listeners.clear();
      state = INITIAL_CHANNEL_STATE;
    },
  };
};
