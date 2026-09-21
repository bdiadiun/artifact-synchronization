import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import type { PendingExchanges } from './pendingExchanges.props.js';

export interface ExchangeDeps<TIncoming extends BridgeMessage, TOutgoing extends BridgeMessage> {
  pending: PendingExchanges<TIncoming>;
  deliver: (message: TOutgoing) => boolean;
  newRequestId: () => string;
  timeoutMs: number;
}
