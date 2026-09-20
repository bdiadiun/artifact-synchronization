// Q-5: the orchestrator sends every command, so it is the one place that knows what the viewer is
// still armed with and can cancel it when the host goes away.

import type { HostCommand } from '@bdiadiun/scoring-contract';
import { deactivateToolCommand } from './commands';

export interface ArmedTool {
  remember: (command: HostCommand) => void;
  disarm: (viewerWindow: Window | null) => void;
}

export const createArmedTool = (viewerOrigin: string): ArmedTool => {
  let armedRowId: string | null = null;

  return {
    remember: (command: HostCommand): void => {
      if (command.type === 'ACTIVATE_TOOL') {
        armedRowId = command.rowId;
        return;
      }
      if (command.type === 'DEACTIVATE_TOOL') {
        armedRowId = null;
      }
    },

    disarm: (viewerWindow: Window | null): void => {
      if (armedRowId === null || viewerWindow === null) {
        return;
      }
      // Never '*': targetOrigin is always the configured viewer origin (Q-2).
      viewerWindow.postMessage(
        deactivateToolCommand(crypto.randomUUID(), armedRowId),
        viewerOrigin,
      );
      armedRowId = null;
    },
  };
};
