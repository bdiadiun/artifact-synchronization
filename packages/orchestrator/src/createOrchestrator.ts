// Framework-free postMessage client for the viewer bridge (A-9, A-10). The channel owns the origin
// check, the guard, the explicit target origin and the request correlation (A-21); this module wires
// it to the queue, the armed-tool memory and the state store, and holds no rule of its own.

import { VIEWER_EVENT_TYPES } from '@bdiadiun/scoring-contract';
import { createPeerPost } from '@bdiadiun/scoring-channel';
import { LOG_PREFIX } from './config';
import { createHostChannel, createViewerEventHandler } from './incomingEvents';
import { createListenerSet, createStateStore } from './orchestratorState';
import { createArmedTool, createCommandDelivery, createCommandQueue } from './outgoingCommands';
import { createTeardown } from './teardown';
import type {
  CreateOrchestratorOptions,
  Orchestrator,
  OrchestratorState,
} from './createOrchestrator.props';

export type {
  CreateOrchestratorOptions,
  HostChannel,
  Orchestrator,
  OrchestratorListener,
  OrchestratorState,
} from './createOrchestrator.props';

export const createOrchestrator = (options: CreateOrchestratorOptions): Orchestrator => {
  const { getViewerWindow, viewerOrigin, hostWindow = window, exchangeTimeoutMs } = options;

  const listeners = createListenerSet();
  const store = createStateStore(listeners);
  let disposed = false;

  // Every queue change is published as a state-only notification (`event: null`).
  const publishQueueLength = (): void => {
    store.patch({ queued: queue.size() });
    store.notify(null);
  };

  const post = createPeerPost({
    peerOrigin: viewerOrigin,
    getPeerWindow: getViewerWindow,
    logPrefix: LOG_PREFIX,
  });
  const queue = createCommandQueue({ post });
  const armedTool = createArmedTool();

  const channel = createHostChannel({
    viewerOrigin,
    hostWindow,
    exchangeTimeoutMs,
    deliver: createCommandDelivery({
      post,
      queue,
      isReady: () => store.get().ready,
      remember: armedTool.remember,
      onQueueChange: publishQueueLength,
    }),
  });

  const handleViewerEvent = createViewerEventHandler({
    store,
    flushQueue: (): void => {
      queue.flush();
      publishQueueLength();
    },
  });

  for (const type of VIEWER_EVENT_TYPES) {
    channel.on(type, handleViewerEvent);
  }

  const teardown = createTeardown({ store, channel, queue, listeners, armedTool });

  const dispose = (): void => {
    disposed = true;
    teardown();
  };

  return {
    send: (type, payload) => (disposed ? false : channel.send(type, payload)),
    exchange: channel.exchange,
    subscribe: listeners.subscribe,
    getState: (): OrchestratorState => store.get(),
    dispose,
  };
};
