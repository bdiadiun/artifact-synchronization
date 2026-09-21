// The only `message` listener either side installs, so the origin check and the contract guard are
// written once (Q-2, Q-7).

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { DEFAULT_LOG_PREFIX } from './config.js';
import type { Disposable } from './disposers.js';

export interface IncomingMessagesOptions<TIncoming extends BridgeMessage> {
  peerOrigin: string;
  isIncoming: (value: unknown) => value is TIncoming;
  onMessage: (message: TIncoming) => void;
  localWindow?: Window;
  logPrefix?: string;
}

export type IncomingMessages = Disposable;

export const createIncomingMessages = <TIncoming extends BridgeMessage>({
  peerOrigin,
  isIncoming,
  onMessage,
  localWindow = window,
  logPrefix = DEFAULT_LOG_PREFIX,
}: IncomingMessagesOptions<TIncoming>): IncomingMessages => {
  // Logged once per foreign origin: a misconfigured origin stays diagnosable without flooding the
  // console with browser extensions and dev-server clients.
  const loggedOrigins = new Set<string>();

  const handleForeignOrigin = (origin: string): void => {
    if (!loggedOrigins.has(origin)) {
      loggedOrigins.add(origin);
      console.debug(`${logPrefix} ignoring message from foreign origin ${origin}`);
    }
  };

  const handleMessage = (event: MessageEvent): void => {
    // Origin check (Q-2): never trust the payload to say who sent it.
    if (event.origin !== peerOrigin) {
      handleForeignOrigin(event.origin);
      return;
    }

    if (!isIncoming(event.data)) {
      console.warn(`${logPrefix} ignoring malformed payload of type ${typeof event.data}`);
      return;
    }

    onMessage(event.data);
  };

  localWindow.addEventListener('message', handleMessage);

  return {
    dispose: (): void => {
      localWindow.removeEventListener('message', handleMessage);
    },
  };
};
