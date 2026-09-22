import type { BridgeMessage } from '@bdiadiun/scoring-contract';

export interface ChannelState {
  ready: boolean;
  queued: number;
}

export const INITIAL_CHANNEL_STATE: ChannelState = { ready: false, queued: 0 };

export type MessageHandlers<TMessage extends BridgeMessage> = {
  [TType in TMessage['type']]: (message: Extract<TMessage, { type: TType }>) => void;
};
