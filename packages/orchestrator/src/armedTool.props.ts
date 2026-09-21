import type { HostCommand } from '@bdiadiun/scoring-contract';

export interface ArmedTool {
  remember: (command: HostCommand) => void;
  disarm: (viewerWindow: Window | null) => void;
}
