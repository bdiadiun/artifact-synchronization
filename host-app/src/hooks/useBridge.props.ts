import type { HostChannel, OrchestratorState } from '@bdiadiun/scoring-orchestrator';

export interface UseBridgeResult {
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
  state: OrchestratorState;
}
