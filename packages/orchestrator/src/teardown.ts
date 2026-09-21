// Unmount order (Q-5): the armed tool is cancelled while the channel is still live, then the
// channel, the queue and the subscribers go away. The shared disposer set gives the order, the
// idempotence and the tolerance of a disposer that throws.

import { createDisposerSet } from '@bdiadiun/scoring-channel';
import { LOG_PREFIX } from './config';
import type { HostChannel } from './createOrchestrator.props';
import type { ListenerSet, StateStore } from './orchestratorState';
import type { ArmedTool, CommandQueue } from './outgoingCommands.props';

export interface TeardownDeps {
  store: StateStore;
  channel: HostChannel;
  queue: CommandQueue;
  listeners: ListenerSet;
  armedTool: ArmedTool;
}

export const createTeardown = ({
  store,
  channel,
  queue,
  listeners,
  armedTool,
}: TeardownDeps): (() => void) => {
  const sendDeactivate = (rowId: string): void => {
    channel.send('DEACTIVATE_TOOL', { rowId });
  };

  const disarm = (): void => {
    // A viewer that never became ready has nothing armed to cancel.
    if (store.get().ready) {
      armedTool.disarm(sendDeactivate);
    }
  };

  const disposers = createDisposerSet({ logPrefix: LOG_PREFIX });

  disposers.add(disarm);
  disposers.add(channel.dispose);
  disposers.add(queue.clear);
  disposers.add(listeners.clear);
  disposers.add(() => {
    store.patch({ ready: false, queued: 0 });
  });

  return disposers.dispose;
};
