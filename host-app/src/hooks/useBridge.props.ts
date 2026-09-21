import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { OrchestratorState } from '@bdiadiun/scoring-orchestrator';

export interface UseBridgeResult {
  send: (command: HostCommand) => void;
  state: OrchestratorState;
}
