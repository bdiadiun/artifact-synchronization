import { useEffect, useSyncExternalStore } from 'react';
import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { listenFrom, LOG_PREFIX, postTo } from './peer.js';

export interface ChannelState {
  ready: boolean;
  queued: number;
}

export interface ChannelOptions<TIn extends BridgeMessage> {
  peerOrigin: string;
  accept: (value: unknown) => value is TIn;
  readyOn?: TIn['type'];
  peerWindow?: Window;
}

export interface Channel<TIn extends BridgeMessage> {
  send: (message: Exclude<BridgeMessage, TIn>) => boolean;
  on: (handle: (message: TIn) => void) => () => void;
  getState: () => ChannelState;
}

const ignore = (): void => undefined;

const queued: BridgeMessage[] = [];
const listeners = new Set<() => void>();
let peer: ChannelOptions<BridgeMessage> | null = null;
let target: Window | null = null;
let state: ChannelState = { ready: false, queued: 0 };
let handle: (message: BridgeMessage) => void = ignore;
let leases = 0;
let stopListening = ignore;

const publish = (next: ChannelState): void => {
  state = next;
  for (const listener of listeners) {
    listener();
  }
};

const send = (message: BridgeMessage): boolean => {
  if (state.ready && peer !== null && postTo(target, peer.peerOrigin, message)) {
    return true;
  }
  queued.push(message);
  publish({ ...state, queued: queued.length });
  return false;
};

const open = (): void => {
  while (peer !== null && queued.length > 0 && postTo(target, peer.peerOrigin, queued[0])) {
    queued.shift();
  }
  publish({ ready: true, queued: queued.length });
};

const receive = (message: BridgeMessage, source: Window | null): void => {
  target = source ?? target;
  if (message.type === peer?.readyOn) {
    open();
  }
  handle(message);
};

const on = (next: (message: never) => void): (() => void) => {
  handle = next as (message: BridgeMessage) => void;

  return () => {
    handle = ignore;
  };
};

const getState = (): ChannelState => state;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const samePeer = (a: ChannelOptions<BridgeMessage>, b: ChannelOptions<BridgeMessage>): boolean =>
  a.peerOrigin === b.peerOrigin &&
  a.accept === b.accept &&
  a.readyOn === b.readyOn &&
  a.peerWindow === b.peerWindow;

const listen = (options: ChannelOptions<BridgeMessage>): (() => void) => {
  if (peer === null) {
    peer = options;
    target = options.peerWindow ?? null;
    if (options.readyOn === undefined) {
      open();
    }
  } else if (!samePeer(peer, options)) {
    console.error(
      `${LOG_PREFIX} one peer per window: keeping ${peer.peerOrigin}, ignoring ${options.peerOrigin}`,
    );
  }

  leases += 1;
  if (leases === 1) {
    stopListening = listenFrom(peer.peerOrigin, peer.accept, receive);
  }

  return () => {
    leases -= 1;
    if (leases === 0) {
      stopListening();
      stopListening = ignore;
    }
  };
};

const channel = { send, on, getState };

export const useChannel = <TIn extends BridgeMessage>({
  peerOrigin,
  accept,
  readyOn,
  peerWindow,
}: ChannelOptions<TIn>): Channel<TIn> => {
  useEffect(
    () => listen({ peerOrigin, accept, readyOn, peerWindow }),
    [peerOrigin, accept, readyOn, peerWindow],
  );
  useSyncExternalStore(subscribe, getState);

  return channel;
};
