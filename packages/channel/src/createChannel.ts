// The typed surface over the mechanics (A-21): `send`, `on`, `onEach` and `exchange`, generic over
// the contract, so nothing is written per message type. Both ends are this, configured differently.

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { buildMessage, needsRequestId } from './buildMessage.js';
import type { PayloadOf } from './buildMessage.js';
import { createExchange } from './exchanges.js';
import { createIncomingMessages } from './incomingMessages.js';
import { createOutbox } from './outbox.js';
import { createPendingExchanges } from './pendingExchanges.js';
import type {
  Channel,
  ChannelOptions,
  MessageHandlers,
  StoredHandler,
} from './createChannel.props.js';

export const createChannel = <TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage>({
  peer,
  isIncoming,
  holdUntil,
}: ChannelOptions<TIncoming>): Channel<TIncoming, TOutgoing> => {
  const outbox = createOutbox<TOutgoing>(peer, holdUntil !== undefined);
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
    // An answer goes to the exchange that asked for it and nowhere else, which is also what keeps
    // the echo of our own request out of the general handlers (A-10).
    if (pending.settle(message)) {
      return;
    }

    // Flushed before the application's handlers run, so whatever queued up is already on its way
    // when the application reacts to the same message (A-9).
    if (message.type === holdUntil) {
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
  ): boolean => outbox.send(buildMessage<TOutgoing, TType>(type, payload, requestId));

  return {
    send: (type, payload) =>
      deliver(type, payload, needsRequestId(type) ? crypto.randomUUID() : undefined),

    on,

    onEach: (messageHandlers: Partial<MessageHandlers<TIncoming>>): (() => void) => {
      // Object.entries widens the keys to string and loses the key-to-handler correlation;
      // `handleIncoming` restores it by calling a handler only with the type it was stored under.
      const unsubscribes = Object.entries(messageHandlers).map(([type, handler]) =>
        on(type as TIncoming['type'], handler as StoredHandler),
      );

      return () => {
        for (const unsubscribe of unsubscribes) {
          unsubscribe();
        }
      };
    },

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
