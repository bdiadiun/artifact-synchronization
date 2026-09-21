import type { BridgeMessage } from '@bdiadiun/scoring-contract';

export interface PeerPostOptions {
  peerOrigin: string;
  // A function, not a value: the other window can be replaced or briefly absent (an iframe that
  // is still mounting, a page that is not framed at all).
  getPeerWindow: () => Window | null;
  logPrefix?: string;
}

// False means "not delivered": there was no peer window to post to.
export type PeerPost = (message: BridgeMessage) => boolean;
