// The way out: the one place that posts to the peer window with an explicit target origin (Q-2),
// holds messages back until that peer says it is ready (Q-1, A-9), and publishes both facts.

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { LOG_PREFIX } from './config.js';

// The other window and the one origin this end talks to (Q-2), as one object: neither half is
// useful without the other, and every part of the channel that needs one needs both.
export interface Peer {
  origin: string;
  // A function, not a value: the window can be replaced or briefly absent (an iframe that is still
  // mounting, a page that is not framed at all).
  getWindow: () => Window | null;
}

// What an application shows about the way out: whether it is open and how much is waiting (P-9).
export interface ChannelState {
  ready: boolean;
  queued: number;
}

export interface Outbox<TOutgoing extends BridgeMessage> {
  send: (message: TOutgoing) => boolean;
  open: () => void;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
}

export const INITIAL_CHANNEL_STATE: ChannelState = { ready: false, queued: 0 };

export const createOutbox = <TOutgoing extends BridgeMessage>(
  peer: Peer,
  held: boolean,
): Outbox<TOutgoing> => {
  const queue: TOutgoing[] = [];
  const listeners = new Set<() => void>();
  let state = INITIAL_CHANNEL_STATE;

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
    console.debug(`${LOG_PREFIX} sent ${message.type}`, message);
    return true;
  };

  return {
    send: (message: TOutgoing): boolean => {
      // An end that holds nothing back posts at once, ready or not: it is its own announcement
      // that opens the way out, and what it cannot deliver it drops rather than growing a queue
      // no handshake will ever flush.
      if (!held) {
        return post(message);
      }

      if (state.ready && post(message)) {
        return true;
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
