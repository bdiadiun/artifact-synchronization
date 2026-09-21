import type { BridgeMessage } from '@bdiadiun/scoring-contract';

export type MessageOfType<TMessage extends BridgeMessage, TType extends TMessage['type']> = Extract<
  TMessage,
  { type: TType }
>;

// What a call site still has to supply: everything but `version`, `type` and the request id the
// channel issues.
export type PayloadOf<TMessage extends BridgeMessage, TType extends TMessage['type']> = Omit<
  MessageOfType<TMessage, TType>,
  'version' | 'type' | 'requestId'
>;
