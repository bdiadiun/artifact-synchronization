import type { BridgeState } from '../bridge/createBridge';
import { UI } from '../ui-strings';

export interface BridgeStatusProps {
  state: BridgeState;
}

// One-line dev diagnostic surface for the bridge handshake and queue (P-9): when a protocol
// element such as VIEWER_READY is disabled or breaks, this line is where it shows up on screen
// instead of only in devtools. Not a product feature; kept deliberately terse.
export function BridgeStatus({ state }: BridgeStatusProps) {
  const readiness = state.ready ? UI.bridgeReady : UI.bridgeNotReady;
  const lastEventType = state.lastEvent?.type ?? '—';

  return (
    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
      {UI.bridgeStatus}: {readiness}, {UI.bridgeQueued}: {state.queued}, {lastEventType}
    </div>
  );
}
