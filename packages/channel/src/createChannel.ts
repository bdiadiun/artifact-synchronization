// The typed surface over the mechanics (A-21): `send`, `on` and `exchange`, generic over the
// contract, so nothing is written per message type.

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { buildMessage, needsRequestId } from './buildMessage.js';
import type { MessageOfType, PayloadOf } from './buildMessage.js';
import { DEFAULT_EXCHANGE_TIMEOUT_MS } from './config.js';
import { createExchange } from './exchanges.js';
import { createIncomingMessages } from './incomingMessages.js';
import { createPendingExchanges } from './pendingExchanges.js';
import type { Channel, ChannelOptions, StoredHandler } from './createChannel.props.js';

export const createChannel = <TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage>(
  options: ChannelOptions<TIncoming, TOutgoing>,
): Channel<TIncoming, TOutgoing> => {
  const {
    deliver,
    exchangeTimeoutMs = DEFAULT_EXCHANGE_TIMEOUT_MS,
    newRequestId = (): string => crypto.randomUUID(),
  } = options;

  const handlers = new Map<TIncoming['type'], Set<StoredHandler>>();
  const pending = createPendingExchanges<TIncoming>();

  const handleIncoming = (message: TIncoming): void => {
    // An answer goes to the exchange that asked for it and nowhere else, which is also what keeps
    // the echo of our own request out of the general handlers (A-10).
    if (pending.settle(message)) {
      return;
    }

    for (const handler of handlers.get(message.type) ?? []) {
      (handler as (incoming: TIncoming) => void)(message);
    }
  };

  const incoming = createIncomingMessages<TIncoming>({ ...options, onMessage: handleIncoming });

  return {
    send: <TType extends TOutgoing['type']>(
      type: TType,
      payload: PayloadOf<TOutgoing, TType>,
    ): boolean => {
      const requestId = needsRequestId(type) ? newRequestId() : undefined;
      return deliver(buildMessage<TOutgoing, TType>(type, payload, requestId));
    },

    on: <TType extends TIncoming['type']>(
      type: TType,
      handler: (message: MessageOfType<TIncoming, TType>) => void,
    ): (() => void) => {
      const forType = handlers.get(type) ?? new Set<StoredHandler>();
      handlers.set(type, forType);
      forType.add(handler);

      return () => {
        forType.delete(handler);
      };
    },

    exchange: createExchange<TIncoming, TOutgoing>({
      pending,
      deliver,
      newRequestId,
      timeoutMs: exchangeTimeoutMs,
    }),

    dispose: (): void => {
      pending.rejectAll('the channel was disposed before the answer arrived');
      incoming.dispose();
      handlers.clear();
    },
  };
};
