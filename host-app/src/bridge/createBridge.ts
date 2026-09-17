// Framework-free postMessage bridge client (A-9, A-10). No React dependency, so it is
// unit-testable and reused by the `useBridge.ts` hook.

import { isViewerEvent, type HostCommand, type ViewerEvent } from '@scoring/contract';

export interface BridgeState {
  ready: boolean;
  queued: number;
  lastEvent: ViewerEvent | null;
  ignoredOrigins: number;
}

// One subscription channel for both events and state-only changes (queue length, origin-ignore
// count) instead of separate "onEvent"/"onStateChange" APIs; `event` is null for the latter.
export type BridgeListener = (event: ViewerEvent | null, state: BridgeState) => void;

export interface CreateBridgeOptions {
  // A function, not a value: the iframe element (and its window) can change or be briefly null
  // while React mounts it.
  getViewerWindow: () => Window | null;
  viewerOrigin: string;
  hostWindow?: Window;
}

export interface Bridge {
  send: (command: HostCommand) => void;
  subscribe: (listener: BridgeListener) => () => void;
  getState: () => BridgeState;
  dispose: () => void;
}

export const createBridge = (options: CreateBridgeOptions): Bridge => {
  const { getViewerWindow, viewerOrigin } = options;
  const hostWindow = options.hostWindow ?? window;

  let state: BridgeState = { ready: false, queued: 0, lastEvent: null, ignoredOrigins: 0 };
  // No coalescing (A-9): commands sent before READY are kept and flushed in call order.
  const queue: HostCommand[] = [];
  const listeners = new Set<BridgeListener>();
  // Logged once per foreign origin, not once per message.
  const loggedOrigins = new Set<string>();
  let disposed = false;

  const setState = (patch: Partial<BridgeState>): void => {
    state = { ...state, ...patch };
  };

  const notify = (event: ViewerEvent | null): void => {
    for (const listener of listeners) {
      listener(event, state);
    }
  };

  const flushQueue = (): void => {
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
      viewerWindow.postMessage(command, viewerOrigin);
    }
    setState({ queued: queue.length });
    notify(null);
  };

  const handleMessage = (event: MessageEvent): void => {
    // Origin check (Q-2): never trust the payload to say who sent it.
    if (event.origin !== viewerOrigin) {
      setState({ ignoredOrigins: state.ignoredOrigins + 1 });
      if (!loggedOrigins.has(event.origin)) {
        loggedOrigins.add(event.origin);
        console.debug('[bridge] ignoring message from foreign origin', event.origin);
      }
      notify(null);
      return;
    }
    if (!isViewerEvent(event.data)) {
      console.warn('[bridge] ignoring malformed payload of type', typeof event.data);
      return;
    }
    const viewerEvent = event.data;
    if (viewerEvent.type === 'VIEWER_READY') {
      // A second READY means a reload (A-9): flip ready false-then-true so subscribers can
      // observe the edge (e.g. re-arm a row stuck in "Drawing…"), then flush what queued up.
      if (state.ready) {
        setState({ ready: false });
        notify(viewerEvent);
      }
      setState({ ready: true, lastEvent: viewerEvent });
      notify(viewerEvent);
      flushQueue();
      return;
    }
    setState({ lastEvent: viewerEvent });
    notify(viewerEvent);
  };

  hostWindow.addEventListener('message', handleMessage);

  const send = (command: HostCommand): void => {
    if (disposed) {
      return;
    }
    const viewerWindow = getViewerWindow();
    // Not ready, or the iframe window is momentarily unavailable: queue instead of losing it (Q-1).
    if (!state.ready || viewerWindow === null) {
      queue.push(command);
      setState({ queued: queue.length });
      notify(null);
      return;
    }
    // Never '*': targetOrigin is always the configured viewer origin (Q-2).
    viewerWindow.postMessage(command, viewerOrigin);
  };

  const subscribe = (listener: BridgeListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getState = (): BridgeState => state;

  const dispose = (): void => {
    // Idempotent: a second call is a no-op.
    if (disposed) {
      return;
    }
    disposed = true;
    hostWindow.removeEventListener('message', handleMessage);
    queue.length = 0;
    listeners.clear();
    setState({ ready: false, queued: 0 });
  };

  return { send, subscribe, getState, dispose };
};
