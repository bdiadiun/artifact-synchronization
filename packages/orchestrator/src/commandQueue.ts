// Commands that cannot be delivered yet (A-9). No coalescing: they are kept and flushed in call
// order.

import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { CommandQueue, CommandQueueOptions } from './commandQueue.props';

export type { CommandQueue, CommandQueueOptions } from './commandQueue.props';

export const createCommandQueue = ({
  getViewerWindow,
  viewerOrigin,
}: CommandQueueOptions): CommandQueue => {
  const queue: HostCommand[] = [];

  const flush = (): void => {
    // Re-checked per command: if the iframe window disappears mid-flush, the remainder stays
    // queued instead of being dropped (Q-1).
    while (queue.length > 0) {
      const viewerWindow = getViewerWindow();
      if (viewerWindow === null) {
        break;
      }
      const command = queue.shift();
      if (command === undefined) {
        break;
      }
      // Never '*': targetOrigin is always the configured viewer origin (Q-2).
      viewerWindow.postMessage(command, viewerOrigin);
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
