// Requests waiting for their answer, with the timer that turns silence into an error (A-21). A
// settled, timed-out or rejected exchange leaves nothing behind.

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import type { PendingExchange, PendingExchanges } from './pendingExchanges.props.js';

// Only an event that names the request it answers can settle one (A-10).
const causeOf = (message: BridgeMessage): string | undefined =>
  'causedBy' in message ? message.causedBy : undefined;

export const createPendingExchanges = <
  TIncoming extends BridgeMessage,
>(): PendingExchanges<TIncoming> => {
  const waiting = new Map<
    string,
    { exchange: PendingExchange<TIncoming>; timer: ReturnType<typeof setTimeout> }
  >();

  return {
    add: (exchange: PendingExchange<TIncoming>): void => {
      const timer = setTimeout(() => {
        waiting.delete(exchange.requestId);
        exchange.reject(
          new Error(
            `${exchange.commandType} ${exchange.requestId} was not answered with ${exchange.answerType} within ${String(exchange.timeoutMs)} ms`,
          ),
        );
      }, exchange.timeoutMs);

      waiting.set(exchange.requestId, { exchange, timer });
    },

    settle: (message: TIncoming): boolean => {
      const causedBy = causeOf(message);

      if (causedBy === undefined) {
        return false;
      }

      const pending = waiting.get(causedBy);

      if (pending?.exchange.answerType !== message.type) {
        return false;
      }

      clearTimeout(pending.timer);
      waiting.delete(causedBy);
      pending.exchange.resolve(message);
      return true;
    },

    rejectAll: (reason: string): void => {
      for (const { exchange, timer } of waiting.values()) {
        clearTimeout(timer);
        exchange.reject(new Error(`${exchange.commandType} ${exchange.requestId}: ${reason}`));
      }
      waiting.clear();
    },
  };
};
