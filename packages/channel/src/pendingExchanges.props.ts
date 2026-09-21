import type { BridgeMessage } from '@bdiadiun/scoring-contract';

export interface PendingExchange<TIncoming extends BridgeMessage> {
  requestId: string;
  commandType: string;
  answerType: string;
  timeoutMs: number;
  resolve: (answer: TIncoming) => void;
  reject: (error: Error) => void;
}

export interface PendingExchanges<TIncoming extends BridgeMessage> {
  add: (exchange: PendingExchange<TIncoming>) => void;
  // True when the message was the answer somebody was waiting for and has been handed to it.
  settle: (message: TIncoming) => boolean;
  rejectAll: (reason: string) => void;
}
