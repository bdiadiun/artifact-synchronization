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

class ChannelEnd {
  private readonly queued: BridgeMessage[] = [];
  private readonly listeners = new Set<() => void>();
  private peer: ChannelOptions<BridgeMessage> | null = null;
  private target: Window | null = null;
  private state: ChannelState = { ready: false, queued: 0 };
  private handle: (message: BridgeMessage) => void = ignore;
  private leases = 0;
  private stopListening = ignore;

  send = (message: BridgeMessage): boolean => {
    if (this.state.ready && this.peer !== null && postTo(this.target, this.peer.peerOrigin, message)) {
      return true;
    }
    this.queued.push(message);
    this.publish({ ...this.state, queued: this.queued.length });
    return false;
  };

  on = (next: (message: never) => void): (() => void) => {
    this.handle = next as (message: BridgeMessage) => void;

    return () => {
      this.handle = ignore;
    };
  };

  getState = (): ChannelState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  listen = (options: ChannelOptions<BridgeMessage>): (() => void) => {
    if (this.peer === null) {
      this.peer = options;
      this.target = options.peerWindow ?? null;
      if (options.readyOn === undefined) {
        this.open();
      }
    } else if (!this.samePeer(options)) {
      console.error(
        `${LOG_PREFIX} one peer per window: keeping ${this.peer.peerOrigin}, ignoring ${options.peerOrigin}`,
      );
    }

    this.leases += 1;
    if (this.leases === 1) {
      this.stopListening = listenFrom(this.peer.peerOrigin, this.peer.accept, this.receive);
    }

    return () => {
      this.leases -= 1;
      if (this.leases === 0) {
        this.stopListening();
        this.stopListening = ignore;
      }
    };
  };

  private publish = (next: ChannelState): void => {
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  };

  private open = (): void => {
    while (this.peer !== null && this.queued.length > 0 && postTo(this.target, this.peer.peerOrigin, this.queued[0])) {
      this.queued.shift();
    }
    this.publish({ ready: true, queued: this.queued.length });
  };

  private receive = (message: BridgeMessage, source: Window | null): void => {
    this.target = source ?? this.target;
    if (message.type === this.peer?.readyOn) {
      this.open();
    }
    this.handle(message);
  };

  private samePeer = (options: ChannelOptions<BridgeMessage>): boolean =>
    this.peer !== null &&
    this.peer.peerOrigin === options.peerOrigin &&
    this.peer.accept === options.accept &&
    this.peer.readyOn === options.readyOn &&
    this.peer.peerWindow === options.peerWindow;
}

const channel = new ChannelEnd();

export const useChannel = <TIn extends BridgeMessage>({
  peerOrigin,
  accept,
  readyOn,
  peerWindow,
}: ChannelOptions<TIn>): Channel<TIn> => {
  useEffect(
    () => channel.listen({ peerOrigin, accept, readyOn, peerWindow }),
    [peerOrigin, accept, readyOn, peerWindow],
  );
  useSyncExternalStore(channel.subscribe, channel.getState);

  return channel;
};
