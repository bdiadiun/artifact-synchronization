import type { BridgeMessage } from '@bdiadiun/scoring-contract';

export type MessageHandlers<TMessage extends BridgeMessage> = {
  [TType in TMessage['type']]: (message: Extract<TMessage, { type: TType }>) => void;
};
