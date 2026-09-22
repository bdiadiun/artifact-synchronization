import type { BridgeMessage } from '@bdiadiun/scoring-contract';

export type PayloadOf<TMessage extends BridgeMessage, TType extends TMessage['type']> = Omit<
  Extract<TMessage, { type: TType }>,
  'type'
>;

export type MessageHandlers<TMessage extends BridgeMessage> = {
  [TType in TMessage['type']]: (message: Extract<TMessage, { type: TType }>) => void;
};
