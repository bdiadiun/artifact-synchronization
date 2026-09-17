import type { JSX } from 'react';
import { UI } from '../ui-strings';
import { styles, type BridgeStatusProps } from './BridgeStatus.props';

// Dev diagnostic surface for the bridge handshake and queue (P-9), not a product feature.
export const BridgeStatus = ({ state }: BridgeStatusProps): JSX.Element => {
  const readiness = state.ready ? UI.bridgeReady : UI.bridgeNotReady;
  const lastEventType = state.lastEvent?.type ?? '—';

  return (
    <div style={styles.status}>
      {UI.bridgeStatus}: {readiness}, {UI.bridgeQueued}: {state.queued}, {lastEventType}
    </div>
  );
};
