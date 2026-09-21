import type { HostCommand } from '@bdiadiun/scoring-contract';

export type SendDeactivate = (rowId: string) => void;

export interface ArmedTool {
  remember: (command: HostCommand) => void;
  disarm: (sendDeactivate: SendDeactivate) => void;
}
