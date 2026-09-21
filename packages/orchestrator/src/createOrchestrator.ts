// Framework-free postMessage client for the viewer bridge (A-9, A-10). No framework dependency,
// so any host can drive a viewer with it. This module only wires the queue and the message handler
// to the listener set; the rules live in those two modules.

import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { createArmedTool } from './armedTool';
import { createCommandQueue } from './commandQueue';
import { createListenerSet } from './listeners';
import { createMessageHandler } from './messageHandler';
import type {
  CreateOrchestratorOptions,
  Orchestrator,
  OrchestratorState,
} from './createOrchestrator.props';

export type {
  CreateOrchestratorOptions,
  Orchestrator,
  OrchestratorListener,
  OrchestratorState,
} from './createOrchestrator.props';

export const createOrchestrator = (options: CreateOrchestratorOptions): Orchestrator => {
  const { getViewerWindow, viewerOrigin, hostWindow = window } = options;

  let state: OrchestratorState = { ready: false, queued: 0, lastEvent: null, ignoredOrigins: 0 };
  const listeners = createListenerSet();
  let disposed = false;

  const setState = (patch: Partial<OrchestratorState>): void => {
    state = { ...state, ...patch };
  };

  const notify = (event: ViewerEvent | null): void => {
    listeners.notify(event, state);
  };

  const queue = createCommandQueue({ getViewerWindow, viewerOrigin });
  const armedTool = createArmedTool(viewerOrigin);

  // Every queue change is published as a state-only notification (`event: null`).
  const publishQueueLength = (): void => {
    setState({ queued: queue.size() });
    notify(null);
  };

  const flushQueue = (): void => {
    queue.flush();
    publishQueueLength();
  };

  const handleMessage = createMessageHandler({
    viewerOrigin,
    getState: () => state,
    setState,
    notify,
    flushQueue,
  });
  hostWindow.addEventListener('message', handleMessage);

  const send = (command: HostCommand): void => {
    if (disposed) {
      return;
    }
    armedTool.remember(command);
    const viewerWindow = getViewerWindow();
    // Not ready, or the iframe window is momentarily unavailable: queue instead of losing it (Q-1).
    if (!state.ready || viewerWindow === null) {
      queue.push(command);
      publishQueueLength();
      return;
    }
    // Never '*': targetOrigin is always the configured viewer origin (Q-2).
    viewerWindow.postMessage(command, viewerOrigin);
  };

  const dispose = (): void => {
    // Idempotent: a second call is a no-op.
    if (disposed) {
      return;
    }
    disposed = true;
    // Never queued: a viewer that never became ready has nothing armed to cancel.
    armedTool.disarm(state.ready ? getViewerWindow() : null);
    hostWindow.removeEventListener('message', handleMessage);
    queue.clear();
    listeners.clear();
    setState({ ready: false, queued: 0 });
  };

  return {
    send,
    subscribe: listeners.subscribe,
    getState: (): OrchestratorState => state,
    dispose,
  };
};
