import type { CSSProperties } from 'react';
import type { OrchestratorState } from '@bdiadiun/scoring-orchestrator';

export interface BridgeStatusProps {
  state: OrchestratorState;
}

export const styles = {
  status: { fontSize: '12px', color: '#666', marginBottom: '8px' },
} satisfies Record<string, CSSProperties>;
