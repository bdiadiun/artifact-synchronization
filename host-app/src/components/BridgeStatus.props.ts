import type { CSSProperties } from 'react';
import type { BridgeState } from '../bridge/createBridge';

export interface BridgeStatusProps {
  state: BridgeState;
}

export const styles = {
  status: { fontSize: '12px', color: '#666', marginBottom: '8px' },
} satisfies Record<string, CSSProperties>;
