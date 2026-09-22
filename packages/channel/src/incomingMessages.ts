// The only `message` listener either end installs, so the origin check and the contract guard are
// written once (Q-2, Q-7).

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { LOG_PREFIX } from './config.js';
import type { Peer } from './outbox.js';
import type { Disposable } from './disposers.js';

export const createIncomingMessages = <TIncoming extends BridgeMessage>(
  peer: Peer,
  isIncoming: (value: unknown) => value is TIncoming,
  onMessage: (message: TIncoming) => void,
): Disposable => {
  // Logged once per foreign origin: a misconfigured origin stays diagnosable without flooding the
  // console with browser extensions and dev-server clients.
  const loggedOrigins = new Set<string>();

  const handleForeignOrigin = (origin: string): void => {
    if (!loggedOrigins.has(origin)) {
      loggedOrigins.add(origin);
      console.debug(`${LOG_PREFIX} ignoring message from foreign origin ${origin}`);
    }
  };

  const handleMessage = (event: MessageEvent): void => {
    // Origin check (Q-2): never trust the payload to say who sent it.
    if (event.origin !== peer.origin) {
      handleForeignOrigin(event.origin);
      return;
    }

    if (!isIncoming(event.data)) {
      console.warn(`${LOG_PREFIX} ignoring malformed payload of type ${typeof event.data}`);
      return;
    }

    onMessage(event.data);
  };

  window.addEventListener('message', handleMessage);

  return {
    dispose: (): void => {
      window.removeEventListener('message', handleMessage);
    },
  };
};
