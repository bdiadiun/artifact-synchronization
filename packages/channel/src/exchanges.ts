// The request half of the surface: a command paired with the event that answers it, or an error when
// nothing answers it in time (A-21).

import { ANSWER_TYPE_BY_COMMAND } from '@bdiadiun/scoring-contract';
import type { AnsweredCommandType, BridgeMessage } from '@bdiadiun/scoring-contract';
import { buildMessage } from './buildMessage.js';
import type { PayloadOf } from './buildMessage.js';
import type { AnswerMessage, Channel } from './createChannel.props.js';

import type { PendingExchanges } from './pendingExchanges.js';
export interface ExchangeDeps<TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage> {
  pending: PendingExchanges<TIncoming>;
  deliver: (message: TOutgoing) => boolean;
  newRequestId: () => string;
  timeoutMs: number;
}

export const createExchange =
  <TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage>({
    pending,
    deliver,
    newRequestId,
    timeoutMs,
  }: ExchangeDeps<TIncoming, TOutgoing>): Channel<TIncoming, TOutgoing>['exchange'] =>
  <TType extends TOutgoing['type'] & AnsweredCommandType>(
    type: TType,
    payload: PayloadOf<TOutgoing, TType>,
  ): Promise<AnswerMessage<TIncoming, TType>> => {
    const requestId = newRequestId();
    const message = buildMessage<TOutgoing, TType>(type, payload, requestId);

    return new Promise<AnswerMessage<TIncoming, TType>>((resolve, reject) => {
      pending.add({
        requestId,
        commandType: type,
        answerType: ANSWER_TYPE_BY_COMMAND[type],
        timeoutMs,
        resolve: (answer: TIncoming): void => {
          resolve(answer as AnswerMessage<TIncoming, TType>);
        },
        reject,
      });

      // A delivery the end holds back (the host's queue until VIEWER_READY) is not a failure; only
      // silence is, and the timeout is what reports it.
      deliver(message);
    });
  };
