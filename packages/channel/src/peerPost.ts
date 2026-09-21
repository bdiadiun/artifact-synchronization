// The only place either side posts a message, so the explicit target origin is written once (Q-2).

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { DEFAULT_LOG_PREFIX } from './config.js';
import type { PeerPost, PeerPostOptions } from './peerPost.props.js';

export const createPeerPost = ({
  peerOrigin,
  getPeerWindow,
  logPrefix = DEFAULT_LOG_PREFIX,
}: PeerPostOptions): PeerPost => {
  return (message: BridgeMessage): boolean => {
    const peerWindow = getPeerWindow();

    if (peerWindow === null) {
      console.debug(`${logPrefix} no peer window -> ${message.type} not delivered`);
      return false;
    }

    // Never '*': the target origin is always the configured peer origin (Q-2).
    peerWindow.postMessage(message, peerOrigin);
    return true;
  };
};
