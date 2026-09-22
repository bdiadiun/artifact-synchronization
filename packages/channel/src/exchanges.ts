// The request half of the surface: a command paired with the event that answers it, or an error when
// nothing answers it in time (A-21).

import { ANSWER_TYPE_BY_COMMAND } from '@bdiadiun/scoring-contract';
import type { AnsweredCommandType, BridgeMessage } from '@bdiadiun/scoring-contract';
import type { PayloadOf } from './buildMessage.js';
import type { AnswerMessage, Channel, Deliver } from './createChannel.props.js';
import type { PendingExchanges } from './pendingExchanges.js';

export const createExchange =
  <TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage>(
    pending: PendingExchanges<TIncoming>,
    deliver: Deliver<TOutgoing>,
  ): Channel<TIncoming, TOutgoing>['exchange'] =>
  <TType extends TOutgoing['type'] & AnsweredCommandType>(
    type: TType,
    payload: PayloadOf<TOutgoing, TType>,
  ): Promise<AnswerMessage<TIncoming, TType>> => {
    const requestId = crypto.randomUUID();
    const answer = pending.awaitAnswer({
      requestId,
      commandType: type,
      answerType: ANSWER_TYPE_BY_COMMAND[type],
    });

    // A message the end holds back (the host's queue until VIEWER_READY) is not a failure; only
    // silence is, and the timeout is what reports it.
    deliver(type, payload, requestId);

    // The answer type follows from the command through the contract's table; the promise the
    // pending store hands back cannot carry that correlation on its own.
    return answer as Promise<AnswerMessage<TIncoming, TType>>;
  };
