import type { BridgeMessage } from '@bdiadiun/scoring-contract';

export interface IncomingMessagesOptions<TIncoming extends BridgeMessage> {
  peerOrigin: string;
  isIncoming: (value: unknown) => value is TIncoming;
  onMessage: (message: TIncoming) => void;
  localWindow?: Window;
  logPrefix?: string;
  // Called for every message refused on its origin, so an end can count or surface them.
  onIgnoredOrigin?: (origin: string) => void;
}

export interface IncomingMessages {
  dispose: () => void;
}
