import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { CONTRACT_VERSION, LOG_PREFIX } from './config.js';

export interface Peer {
  origin: string;
  getWindow: () => Window | null;
}

export const postTo = (peer: Peer, message: BridgeMessage): boolean => {
  const peerWindow = peer.getWindow();

  if (peerWindow === null) {
    console.debug(`${LOG_PREFIX} no peer window -> ${message.type} not delivered`);
    return false;
  }

  peerWindow.postMessage({ version: CONTRACT_VERSION, ...message }, peer.origin);
  console.debug(`${LOG_PREFIX} sent ${message.type}`, message);
  return true;
};

const versionOf = (data: unknown): unknown =>
  typeof data === 'object' && data !== null && 'version' in data ? data.version : undefined;

export const listenFrom = <TMessage extends BridgeMessage>(
  peer: Peer,
  isMessage: (value: unknown) => value is TMessage,
  onMessage: (message: TMessage) => void,
): (() => void) => {
  const loggedOrigins = new Set<string>();
  const loggedVersions = new Set<unknown>();

  const handleMessage = (event: MessageEvent): void => {
    if (event.origin !== peer.origin) {
      if (!loggedOrigins.has(event.origin)) {
        loggedOrigins.add(event.origin);
        console.debug(`${LOG_PREFIX} ignoring message from foreign origin ${event.origin}`);
      }
      return;
    }

    const version = versionOf(event.data);

    if (version !== CONTRACT_VERSION) {
      if (!loggedVersions.has(version)) {
        loggedVersions.add(version);
        console.debug(`${LOG_PREFIX} ignoring message of contract version ${String(version)}`);
      }
      return;
    }

    if (!isMessage(event.data)) {
      console.warn(`${LOG_PREFIX} ignoring malformed payload of type ${typeof event.data}`);
      return;
    }

    console.debug(`${LOG_PREFIX} received ${event.data.type}`, event.data);
    onMessage(event.data);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
};
