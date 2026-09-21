// What happens to a command on its way out: the armed row is remembered, then the command is posted
// or, until the viewer says it is ready, queued (Q-1, A-9).

import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { CommandDelivery, CommandDeliveryDeps } from './delivery.props';

export type { CommandDelivery, CommandDeliveryDeps } from './delivery.props';

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
