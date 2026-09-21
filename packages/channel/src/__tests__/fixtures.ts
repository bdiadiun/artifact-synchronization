// Shared test doubles for the channel's own tests: a fake window that behaves like the real one for
// the one thing the channel needs (a `message` listener), and the two directions of the protocol
// built from the actual contract, so the tests exercise real guards, not stand-ins for them.

import { isHostCommand, isViewerEvent } from '@bdiadiun/scoring-contract';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { createChannel } from '../createChannel';
import type { Channel } from '../createChannel.props';

export const HOST_ORIGIN = 'http://localhost:5173';
export const VIEWER_ORIGIN = 'http://localhost:3000';

// A plain EventTarget stands in for `window`: the channel only ever calls addEventListener,
// removeEventListener and (indirectly, through the test) dispatchEvent on it.
export const createFakeWindow = (): Window => new EventTarget() as unknown as Window;

export const dispatchMessage = (target: Window, data: unknown, origin: string): void => {
  target.dispatchEvent(new MessageEvent('message', { data, origin }));
};

export interface HostChannelFixture {
  channel: Channel<ViewerEvent, HostCommand>;
  deliver: (message: HostCommand) => boolean;
  delivered: HostCommand[];
  localWindow: Window;
  onIgnoredOrigin: (origin: string) => void;
  ignoredOrigins: string[];
}

// The host end: sends `HostCommand`s, receives `ViewerEvent`s.
export const createHostChannelFixture = (
  overrides: Partial<{ exchangeTimeoutMs: number; deliverResult: boolean }> = {},
): HostChannelFixture => {
  const delivered: HostCommand[] = [];
  const ignoredOrigins: string[] = [];
  const localWindow = createFakeWindow();

  const deliver = (message: HostCommand): boolean => {
    delivered.push(message);
    return overrides.deliverResult ?? true;
  };
  const onIgnoredOrigin = (origin: string): void => {
    ignoredOrigins.push(origin);
  };

  const channel = createChannel<ViewerEvent, HostCommand>({
    peerOrigin: VIEWER_ORIGIN,
    isIncoming: isViewerEvent,
    deliver,
    localWindow,
    exchangeTimeoutMs: overrides.exchangeTimeoutMs,
    onIgnoredOrigin,
  });

  return { channel, deliver, delivered, localWindow, onIgnoredOrigin, ignoredOrigins };
};

export interface ViewerChannelFixture {
  channel: Channel<HostCommand, ViewerEvent>;
  delivered: ViewerEvent[];
  localWindow: Window;
  ignoredOrigins: string[];
}

// The viewer end: sends `ViewerEvent`s, receives `HostCommand`s. Proves the same mechanics work in
// the opposite direction, with the opposite guard.
export const createViewerChannelFixture = (): ViewerChannelFixture => {
  const delivered: ViewerEvent[] = [];
  const ignoredOrigins: string[] = [];
  const localWindow = createFakeWindow();

  const channel = createChannel<HostCommand, ViewerEvent>({
    peerOrigin: HOST_ORIGIN,
    isIncoming: isHostCommand,
    deliver: (message: ViewerEvent): boolean => {
      delivered.push(message);
      return true;
    },
    localWindow,
    onIgnoredOrigin: (origin: string): void => {
      ignoredOrigins.push(origin);
    },
  });

  return { channel, delivered, localWindow, ignoredOrigins };
};
