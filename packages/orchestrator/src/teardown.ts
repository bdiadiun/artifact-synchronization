// Unmount order (Q-5): the armed tool is cancelled while the channel is still live, then the channel,
// the queue and the subscribers go away. Idempotent, so a second call is a no-op.

import type { TeardownDeps } from './teardown.props';

export const createTeardown = ({
  store,
  channel,
  queue,
  listeners,
  armedTool,
}: TeardownDeps): (() => void) => {
  let done = false;

  const sendDeactivate = (rowId: string): void => {
    channel.send('DEACTIVATE_TOOL', { rowId });
  };

  return (): void => {
    if (done) {
      return;
    }
    // A viewer that never became ready has nothing armed to cancel.
    if (store.get().ready) {
      armedTool.disarm(sendDeactivate);
    }
    done = true;
    channel.dispose();
    queue.clear();
    listeners.clear();
    store.patch({ ready: false, queued: 0 });
  };
};
