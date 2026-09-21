import type { AnsweredCommandType, AnswerTypeOf, BridgeMessage } from '@bdiadiun/scoring-contract';
import type { MessageOfType, PayloadOf } from './buildMessage.js';

export type AnswerMessage<
  TIncoming extends BridgeMessage,
  TType extends AnsweredCommandType,
> = Extract<TIncoming, { type: AnswerTypeOf<TType> }>;

export interface ChannelOptions<TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage> {
  peerOrigin: string;
  isIncoming: (value: unknown) => value is TIncoming;
  // How this end reaches the other window. `createPeerPost` is the plain implementation; an end
  // that has to hold messages back (the host queues until VIEWER_READY) wraps it and returns false.
  deliver: (message: TOutgoing) => boolean;
  localWindow?: Window;
  logPrefix?: string;
  exchangeTimeoutMs?: number;
  newRequestId?: () => string;
  onIgnoredOrigin?: (origin: string) => void;
}

export interface Channel<TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage> {
  send: <TType extends TOutgoing['type']>(
    type: TType,
    payload: PayloadOf<TOutgoing, TType>,
  ) => boolean;
  on: <TType extends TIncoming['type']>(
    type: TType,
    handler: (message: MessageOfType<TIncoming, TType>) => void,
  ) => () => void;
  exchange: <TType extends TOutgoing['type'] & AnsweredCommandType>(
    type: TType,
    payload: PayloadOf<TOutgoing, TType>,
  ) => Promise<AnswerMessage<TIncoming, TType>>;
  dispose: () => void;
}

// A stored handler accepts only the type it was registered under; `never` keeps the store
// assignable from every handler and forces the dispatch to state that guarantee once.
export type StoredHandler = (message: never) => void;
