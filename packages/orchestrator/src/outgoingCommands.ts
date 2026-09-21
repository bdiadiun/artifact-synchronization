// The way out: what a command does on its way to the viewer. It is remembered as the armed row
// (Q-5), then posted or, until the viewer says it is ready, queued in call order (Q-1, A-9).

import type { HostCommand } from '@bdiadiun/scoring-contract';
import type {
  ArmedTool,
  CommandDelivery,
  CommandDeliveryDeps,
  CommandQueue,
  CommandQueueOptions,
  SendDeactivate,
} from './outgoingCommands.props';

export type {
  ArmedTool,
  CommandDelivery,
  CommandDeliveryDeps,
  CommandQueue,
  CommandQueueOptions,
  SendDeactivate,
} from './outgoingCommands.props';

// The orchestrator sends every command, so it is the one place that knows what the viewer is still
// armed with and can cancel it when the host goes away.
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

// Commands that cannot be delivered yet (A-9). No coalescing: they are kept and flushed in call
// order.
export const createCommandQueue = ({ post }: CommandQueueOptions): CommandQueue => {
  const queue: HostCommand[] = [];

  const flush = (): void => {
    // Checked per command: if the viewer window disappears mid-flush, the remainder stays queued
    // instead of being dropped (Q-1).
    while (queue.length > 0 && post(queue[0])) {
      queue.shift();
    }
  };

  return {
    push: (command: HostCommand): void => {
      queue.push(command);
    },
    flush,
    clear: (): void => {
      queue.length = 0;
    },
    size: (): number => queue.length,
  };
};

export const createCommandDelivery =
  ({ post, queue, isReady, remember, onQueueChange }: CommandDeliveryDeps): CommandDelivery =>
  (command: HostCommand): boolean => {
    remember(command);

    if (isReady() && post(command)) {
      return true;
    }

    queue.push(command);
    onQueueChange();
    return false;
  };
