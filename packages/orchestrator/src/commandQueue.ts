// Commands that cannot be delivered yet (A-9). No coalescing: they are kept and flushed in call
// order.

import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { CommandQueue, CommandQueueOptions } from './commandQueue.props';

export type { CommandQueue, CommandQueueOptions } from './commandQueue.props';

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
