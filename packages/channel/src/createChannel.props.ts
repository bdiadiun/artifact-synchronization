import type { AnsweredCommandType, AnswerTypeOf, BridgeMessage } from '@bdiadiun/scoring-contract';
import type { MessageOfType, PayloadOf } from './buildMessage.js';
import type { Disposable } from './disposers.js';

// The other window and the one origin this end talks to (Q-2), as one object: neither half is
// useful without the other, and every part of the channel that needs one needs both.
export interface Peer {
  origin: string;
  // A function, not a value: the window can be replaced or briefly absent (an iframe that is still
  // mounting, a page that is not framed at all).
  getWindow: () => Window | null;
}

// What an application shows about the way out: whether it is open and how much is waiting (P-9).
export interface ChannelState {
  ready: boolean;
  queued: number;
}

export interface ChannelOptions<TIncoming extends BridgeMessage> {
  peer: Peer;
  isIncoming: (value: unknown) => value is TIncoming;
  // The incoming message that opens the way out; until it arrives, outgoing messages are kept in
  // call order (A-9). An end that names none is open from the start.
  holdUntil?: TIncoming['type'];
}

export type AnswerMessage<
  TIncoming extends BridgeMessage,
  TType extends AnsweredCommandType,
> = Extract<TIncoming, { type: AnswerTypeOf<TType> }>;

// A handler per message type, so a set of handlers can be checked against the contract with one
// `satisfies` clause; the ends that only care about some of them pass a `Partial`.
export type MessageHandlers<TMessage extends BridgeMessage> = {
  [TType in TMessage['type']]: (message: MessageOfType<TMessage, TType>) => void;
};

export interface Channel<
  TIncoming extends BridgeMessage,
  TOutgoing extends BridgeMessage,
> extends Disposable {
  // True only when the message went out now; false when it was kept for later.
  send: <TType extends TOutgoing['type']>(
    type: TType,
    payload: PayloadOf<TOutgoing, TType>,
  ) => boolean;
  on: <TType extends TIncoming['type']>(
    type: TType,
    handler: (message: MessageOfType<TIncoming, TType>) => void,
  ) => () => void;
  // One registration and one unsubscribe for a whole set of handlers.
  onEach: (handlers: Partial<MessageHandlers<TIncoming>>) => () => void;
  exchange: <TType extends TOutgoing['type'] & AnsweredCommandType>(
    type: TType,
    payload: PayloadOf<TOutgoing, TType>,
  ) => Promise<AnswerMessage<TIncoming, TType>>;
  // The same object until a value in it changes, so a subscriber can compare by identity.
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
}

// What the core hands a message to when it is finally built: the type, its payload and the request
// id the channel issued for it.
export type Deliver<TOutgoing extends BridgeMessage> = <TType extends TOutgoing['type']>(
  type: TType,
  payload: PayloadOf<TOutgoing, TType>,
  requestId: string | undefined,
) => boolean;

// A stored handler accepts only the type it was registered under; `never` keeps the store
// assignable from every handler and forces the dispatch to state that guarantee once.
export type StoredHandler = (message: never) => void;
