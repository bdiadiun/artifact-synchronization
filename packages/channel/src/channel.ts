import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { listenFrom, postTo } from './peer.js';

export interface ChannelState {
  ready: boolean;
  queued: number;
  announcements: number;
}

export interface Channel<TIn extends BridgeMessage> {
  send: (message: Exclude<BridgeMessage, TIn>) => boolean;
  onMessage: (handle: (message: TIn) => void) => () => void;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

export interface ChannelOptions<TIn extends BridgeMessage> {
  peerOrigin: string;
  accept: (value: unknown) => value is TIn;
  readyOn?: TIn['type'];
  peerWindow?: Window;
}

const ignore = (): void => undefined;

export const createChannel = <TIn extends BridgeMessage>(
  options: ChannelOptions<TIn>,
): Channel<TIn> => {
  const queued: BridgeMessage[] = [];
  const listeners = new Set<() => void>();
  let peerWindow = options.peerWindow ?? null;
  let state: ChannelState = { ready: options.readyOn === undefined, queued: 0, announcements: 0 };
  let handle: (message: TIn) => void = ignore;

  const publish = (next: ChannelState): void => {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  };

  const send = (message: BridgeMessage): boolean => {
    if (state.ready && postTo(peerWindow, options.peerOrigin, message)) {
      return true;
    }
    queued.push(message);
    publish({ ...state, queued: queued.length });
    return false;
  };

  const announce = (): void => {
    while (queued.length > 0 && postTo(peerWindow, options.peerOrigin, queued[0])) {
      queued.shift();
    }
    publish({ ready: true, queued: queued.length, announcements: state.announcements + 1 });
  };

  const onMessage = (next: (message: TIn) => void): (() => void) => {
    handle = next;

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

  const stopListening = listenFrom(options.peerOrigin, options.accept, (message, source) => {
    peerWindow = source ?? peerWindow;
    if (message.type === options.readyOn) {
      announce();
    }
    handle(message);
  });

  const dispose = (): void => {
    stopListening();
    handle = ignore;
    queued.length = 0;
    listeners.clear();
  };

  return { send, onMessage, getState, subscribe, dispose };
};
