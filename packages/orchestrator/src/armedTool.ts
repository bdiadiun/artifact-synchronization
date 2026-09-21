// Q-5: the orchestrator sends every command, so it is the one place that knows what the viewer is
// still armed with and can cancel it when the host goes away.

import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { ArmedTool, SendDeactivate } from './armedTool.props';

export type { ArmedTool, SendDeactivate } from './armedTool.props';

export const createArmedTool = (): ArmedTool => {
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

    disarm: (sendDeactivate: SendDeactivate): void => {
      if (armedRowId === null) {
        return;
      }
      sendDeactivate(armedRowId);
      armedRowId = null;
    },
  };
};
