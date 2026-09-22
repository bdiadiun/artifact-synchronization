// Requests waiting for their answer, with the timer that turns silence into an error (A-21). A
// settled, timed-out or rejected exchange leaves nothing behind.

import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import { EXCHANGE_TIMEOUT_MS } from './config.js';

export interface PendingRequest {
  requestId: string;
  commandType: string;
  answerType: string;
}

export interface PendingExchanges<TIncoming extends BridgeMessage> {
  // Resolves with the answer to this request, or rejects when none arrives in time.
  awaitAnswer: (request: PendingRequest) => Promise<TIncoming>;
  // True when the message was the answer somebody was waiting for and has been handed to it.
  settle: (message: TIncoming) => boolean;
  rejectAll: (reason: string) => void;
}

interface Waiting<TIncoming extends BridgeMessage> {
  request: PendingRequest;
  timer: ReturnType<typeof setTimeout>;
  resolve: (answer: TIncoming) => void;
  reject: (error: Error) => void;
}

// Only an event that names the request it answers can settle one (A-10).
const causeOf = (message: BridgeMessage): string | undefined =>
  'causedBy' in message ? message.causedBy : undefined;

export const createPendingExchanges = <
  TIncoming extends BridgeMessage,
>(): PendingExchanges<TIncoming> => {
  const waiting = new Map<string, Waiting<TIncoming>>();

  return {
    awaitAnswer: (request: PendingRequest): Promise<TIncoming> =>
      new Promise<TIncoming>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(request.requestId);
          reject(
            new Error(
              `${request.commandType} ${request.requestId} was not answered with ${request.answerType} within ${String(EXCHANGE_TIMEOUT_MS)} ms`,
            ),
          );
        }, EXCHANGE_TIMEOUT_MS);

        waiting.set(request.requestId, { request, timer, resolve, reject });
      }),

    settle: (message: TIncoming): boolean => {
      const causedBy = causeOf(message);

      if (causedBy === undefined) {
        return false;
      }

      const pending = waiting.get(causedBy);

      if (pending?.request.answerType !== message.type) {
        return false;
      }

      clearTimeout(pending.timer);
      waiting.delete(causedBy);
      pending.resolve(message);
      return true;
    },

    rejectAll: (reason: string): void => {
      for (const { request, timer, reject } of waiting.values()) {
        clearTimeout(timer);
        reject(new Error(`${request.commandType} ${request.requestId}: ${reason}`));
      }
      waiting.clear();
    },
  };
};
