// The typed surface over the mechanics (A-21): `send`, `on`, `onEach` and `exchange`, generic over
// the contract, so nothing is written per message type. Both ends are this, configured differently.

import type { AnsweredCommandType, AnswerTypeOf, BridgeMessage } from '@bdiadiun/scoring-contract';
import { buildMessage, needsRequestId } from './buildMessage.js';
import type { MessageOfType, PayloadOf } from './buildMessage.js';
import { createExchange } from './exchanges.js';
import { createIncomingMessages } from './incomingMessages.js';
import { createOutbox } from './outbox.js';
import type { ChannelState, Peer } from './outbox.js';
import { createPendingExchanges } from './pendingExchanges.js';
import { LOG_PREFIX } from './config.js';
import type { Disposable } from './disposers.js';

// What opens this end's way out. The host waits for the message in which the peer announces
// itself and keeps its commands in call order until then (A-9); the viewer opens the way out by
// announcing itself and keeps nothing back, because an unframed viewer has nobody to answer.
export type ChannelGate<TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage> =
  | { opensOn: 'incoming'; type: TIncoming['type'] }
  | { opensOn: 'outgoing'; type: TOutgoing['type'] };

export interface ChannelOptions<TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage> {
  peer: Peer;
  isIncoming: (value: unknown) => value is TIncoming;
  gate: ChannelGate<TIncoming, TOutgoing>;
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

// A stored handler accepts only the type it was registered under; `never` keeps the store
// assignable from every handler and forces the dispatch to state that guarantee once.
type StoredHandler = (message: never) => void;

// Object.entries widens the keys to string and loses the key-to-handler correlation; the channel's
// dispatch restores it by calling a handler only with the type it was stored under.
const subscribeEach = <TIncoming extends BridgeMessage>(
  on: (type: TIncoming['type'], handler: StoredHandler) => () => void,
  messageHandlers: Partial<MessageHandlers<TIncoming>>,
): (() => void) => {
  const unsubscribes = Object.entries(messageHandlers).map(([type, handler]) =>
    on(type as TIncoming['type'], handler as StoredHandler),
  );

  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
};

export const createChannel = <TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage>({
  peer,
  isIncoming,
  gate,
}: ChannelOptions<TIncoming, TOutgoing>): Channel<TIncoming, TOutgoing> => {
  const outbox = createOutbox<TOutgoing>(peer, gate.opensOn === 'incoming');
  const handlers = new Map<TIncoming['type'], Set<StoredHandler>>();
  const pending = createPendingExchanges<TIncoming>();

  const on = (type: TIncoming['type'], handler: StoredHandler): (() => void) => {
    const forType = handlers.get(type) ?? new Set<StoredHandler>();
    handlers.set(type, forType);
    forType.add(handler);

    return () => {
      forType.delete(handler);
    };
  };

  const handleIncoming = (message: TIncoming): void => {
    console.debug(`${LOG_PREFIX} received ${message.type}`, message);

    // An answer goes to the exchange that asked for it and nowhere else, which is also what keeps
    // the echo of our own request out of the general handlers (A-10).
    if (pending.settle(message)) {
      return;
    }

    // Flushed before the application's handlers run, so whatever queued up is already on its way
    // when the application reacts to the same message (A-9).
    if (gate.opensOn === 'incoming' && message.type === gate.type) {
      outbox.open();
    }

    for (const handler of handlers.get(message.type) ?? []) {
      (handler as (incoming: TIncoming) => void)(message);
    }
  };

  const incoming = createIncomingMessages<TIncoming>(peer, isIncoming, handleIncoming);

  const deliver = <TType extends TOutgoing['type']>(
    type: TType,
    payload: PayloadOf<TOutgoing, TType>,
    requestId: string | undefined,
  ): boolean => {
    const sent = outbox.send(buildMessage<TOutgoing, TType>(type, payload, requestId));

    // An end that announces itself is open only once the announcement was really delivered: until
    // then there is no peer window listening to it.
    if (sent && gate.opensOn === 'outgoing' && type === gate.type) {
      outbox.open();
    }

    return sent;
  };

  return {
    send: (type, payload) =>
      deliver(type, payload, needsRequestId(type) ? crypto.randomUUID() : undefined),

    on,

    onEach: (messageHandlers: Partial<MessageHandlers<TIncoming>>): (() => void) =>
      subscribeEach<TIncoming>(on, messageHandlers),

    exchange: createExchange<TIncoming, TOutgoing>(pending, deliver),

    getState: outbox.getState,
    subscribe: outbox.subscribe,

    dispose: (): void => {
      pending.rejectAll('the channel was disposed before the answer arrived');
      incoming.dispose();
      handlers.clear();
      outbox.clear();
    },
  };
};
