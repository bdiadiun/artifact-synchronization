import type { CSSProperties } from 'react';
import type { ChannelState } from '@bdiadiun/scoring-channel';

export interface BridgeStatusProps {
  state: ChannelState;
}

export const styles = {
  status: { fontSize: '12px', color: '#666', marginBottom: '8px' },
} satisfies Record<string, CSSProperties>;
