import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { listenFrom, postTo } from './peer.js';

export interface ChannelState {
  ready: boolean;
  queued: number;
}

export const INITIAL_CHANNEL_STATE: ChannelState = { ready: false, queued: 0 };

export interface Channel<TIn extends BridgeMessage> {
  send: (message: Exclude<BridgeMessage, TIn>) => boolean;
  onMessage: (handle: (message: TIn) => void) => () => void;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

export interface ChannelOptions<TIn extends BridgeMessage> {
  peerOrigin: string;
  getPeerWindow: () => Window | null;
  accept: (value: unknown) => value is TIn;
  readyOn?: TIn['type'];
}

const ignore = (): void => undefined;

const addListener = (listeners: Set<() => void>, listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const createChannel = <TIn extends BridgeMessage>(
  options: ChannelOptions<TIn>,
): Channel<TIn> => {
  const peer = { origin: options.peerOrigin, getWindow: options.getPeerWindow };
  const queued: BridgeMessage[] = [];
  const listeners = new Set<() => void>();
  let state: ChannelState = { ready: options.readyOn === undefined, queued: 0 };
  let handle: (message: TIn) => void = ignore;
  let disposed = false;

  const publish = (ready: boolean): void => {
    if (ready === state.ready && queued.length === state.queued) {
      return;
    }
    state = { ready, queued: queued.length };
    for (const listener of listeners) {
      listener();
    }
  };

  const send = (message: BridgeMessage): boolean => {
    if (disposed) {
      return false;
    }
    if (state.ready && postTo(peer, message)) {
      return true;
    }
    queued.push(message);
    publish(state.ready);
    return false;
  };

  const flush = (): void => {
    while (queued.length > 0 && postTo(peer, queued[0])) {
      queued.shift();
    }
    publish(true);
  };

  const onMessage = (next: (message: TIn) => void): (() => void) => {
    handle = next;

    return () => {
      handle = ignore;
    };
  };

  const getState = (): ChannelState => state;

  const subscribe = (listener: () => void): (() => void) => addListener(listeners, listener);

  const stopListening = listenFrom(peer, options.accept, (message) => {
    if (message.type === options.readyOn) {
      flush();
    }
    handle(message);
  });

  const dispose = (): void => {
    disposed = true;
    stopListening();
    handle = ignore;
    queued.length = 0;
    listeners.clear();
  };

  return { send, onMessage, getState, subscribe, dispose };
};
