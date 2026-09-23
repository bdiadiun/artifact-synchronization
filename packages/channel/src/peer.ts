import type { BridgeMessage } from '@bdiadiun/scoring-contract';

const CONTRACT_VERSION = 1;

export const LOG_PREFIX = '[channel]';

export const postTo = (peerWindow: Window | null, peerOrigin: string, message: BridgeMessage): boolean => {
  if (peerWindow === null) {
    console.debug(`${LOG_PREFIX} no peer window yet -> ${message.type} not delivered`);
    return false;
  }

  peerWindow.postMessage({ version: CONTRACT_VERSION, ...message }, peerOrigin);
  console.debug(`${LOG_PREFIX} sent ${message.type}`, message);
  return true;
};

const versionOf = (data: unknown): unknown =>
  typeof data === 'object' && data !== null && 'version' in data ? data.version : undefined;

const isWindow = (source: MessageEventSource | null): source is Window => source !== null && 'parent' in source;

export const listenFrom = <TMessage extends BridgeMessage>(
  peerOrigin: string,
  accept: (value: unknown) => value is TMessage,
  deliver: (message: TMessage, source: Window | null) => void,
): (() => void) => {
  const loggedOrigins = new Set<string>();
  const loggedVersions = new Set<unknown>();

  const handleMessage = (event: MessageEvent): void => {
    if (event.origin !== peerOrigin) {
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

    if (!accept(event.data)) {
      console.warn(`${LOG_PREFIX} ignoring malformed payload of type ${typeof event.data}`);
      return;
    }

    console.debug(`${LOG_PREFIX} received ${event.data.type}`, event.data);
    deliver(event.data, isWindow(event.source) ? event.source : null);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
  };
};
