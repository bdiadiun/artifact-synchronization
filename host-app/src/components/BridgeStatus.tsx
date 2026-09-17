import type { JSX } from 'react';
import type { BridgeState } from '../bridge/createBridge';
import { UI } from '../ui-strings';

export interface BridgeStatusProps {
  state: BridgeState;
}

// Dev diagnostic surface for the bridge handshake and queue (P-9), not a product feature.
export const BridgeStatus = ({ state }: BridgeStatusProps): JSX.Element => {
  const readiness = state.ready ? UI.bridgeReady : UI.bridgeNotReady;
  const lastEventType = state.lastEvent?.type ?? '—';

  return (
    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
      {UI.bridgeStatus}: {readiness}, {UI.bridgeQueued}: {state.queued}, {lastEventType}
    </div>
  );
};
