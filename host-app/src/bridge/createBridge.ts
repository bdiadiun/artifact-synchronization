// Framework-free postMessage bridge client (canon C-3.1, Q-1, Q-2, Q-5, P-1, P-9; decisions A-9,
// A-10). This module has no React dependency so it can be unit-tested and reused outside the
// hook in `useBridge.ts`.

import { isViewerEvent, type HostCommand, type ViewerEvent } from '@scoring/contract';

// Observable state of the bridge; exposed for the dev status line (P-9) and for `useBridge`.
export interface BridgeState {
  // Set once VIEWER_READY has been seen; false again for the instant a reload's second
  // VIEWER_READY is being processed (A-9), so listeners can detect the reload edge.
  ready: boolean;
  // Number of commands currently waiting for `ready` before they are posted.
  queued: number;
  // Most recent viewer event dispatched to listeners, kept for diagnostics.
  lastEvent: ViewerEvent | null;
  // Count of `message` events dropped because `event.origin` did not match `viewerOrigin` (Q-2).
  ignoredOrigins: number;
}

// Single subscription API: a listener receives every viewer event as it is dispatched, and is
// also invoked with `event = null` whenever the state changes without a corresponding viewer
// event (queue length changing on `send`, or the origin-ignore counter ticking up). This keeps
// the bridge to one subscription channel instead of two ("onEvent" + "onStateChange") that
// callers would otherwise have to wire up separately.
export type BridgeListener = (event: ViewerEvent | null, state: BridgeState) => void;

export interface CreateBridgeOptions {
  // Resolves the current iframe `contentWindow`; a function (not a value) because the iframe
  // element, and therefore its window, can change or be briefly `null` while React mounts it.
  getViewerWindow: () => Window | null;
  // The only origin accepted for incoming messages and used as `postMessage` targetOrigin (Q-2).
  viewerOrigin: string;
  // Window to attach the `message` listener to; overridable for tests, defaults to `window`.
  hostWindow?: Window;
}

export interface Bridge {
  send: (command: HostCommand) => void;
  subscribe: (listener: BridgeListener) => () => void;
  getState: () => BridgeState;
  dispose: () => void;
}

export function createBridge(options: CreateBridgeOptions): Bridge {
  const { getViewerWindow, viewerOrigin } = options;
  const hostWindow = options.hostWindow ?? window;

  let state: BridgeState = { ready: false, queued: 0, lastEvent: null, ignoredOrigins: 0 };
  // FIFO queue, no coalescing (A-9): every command sent before READY is kept and flushed in the
  // exact order `send` was called.
  const queue: HostCommand[] = [];
  const listeners = new Set<BridgeListener>();
  // Foreign origins already logged, so repeated noise from the same origin produces only one
  // `console.debug` per instance instead of one per message.
  const loggedOrigins = new Set<string>();
  let disposed = false;

  function setState(patch: Partial<BridgeState>): void {
    state = { ...state, ...patch };
  }

  function notify(event: ViewerEvent | null): void {
    // Snapshot the listener set is unnecessary here since `subscribe`/`unsubscribe` mutate the
    // same Set object, but iterating a Set that a listener removes itself from mid-iteration is
    // still safe in JS (deleted entries are simply skipped).
    for (const listener of listeners) {
      listener(event, state);
    }
  }

  function flushQueue(): void {
    // Re-checked per command: if the iframe window disappears mid-flush, stop and keep the
    // remainder queued rather than dropping it (Q-1).
    while (queue.length > 0) {
      const viewerWindow = getViewerWindow();
      if (viewerWindow === null) {
        break;
      }
      const command = queue.shift() as HostCommand;
      viewerWindow.postMessage(command, viewerOrigin);
    }
    setState({ queued: queue.length });
    notify(null);
  }

  function handleMessage(event: MessageEvent): void {
    // Origin check (Q-2): drop anything not from the configured viewer origin, never trust the
    // payload to say who sent it.
    if (event.origin !== viewerOrigin) {
      setState({ ignoredOrigins: state.ignoredOrigins + 1 });
      if (!loggedOrigins.has(event.origin)) {
        loggedOrigins.add(event.origin);
        console.debug('[bridge] ignoring message from foreign origin', event.origin);
      }
      notify(null);
      return;
    }
    // Shape/version check via the shared contract guard: anything that does not parse as a
    // known ViewerEvent is dropped rather than dispatched to listeners.
    if (!isViewerEvent(event.data)) {
      console.warn('[bridge] ignoring malformed payload of type', typeof event.data);
      return;
    }
    const viewerEvent = event.data;
    if (viewerEvent.type === 'VIEWER_READY') {
      // A second READY means the viewer reloaded (A-9): flip ready false-then-true so
      // subscribers can observe the edge (e.g. re-arm a row stuck in "Drawing…"), then flush
      // whatever queued up in the meantime.
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
  }

  hostWindow.addEventListener('message', handleMessage);

  function send(command: HostCommand): void {
    if (disposed) {
      return;
    }
    const viewerWindow = getViewerWindow();
    // Not ready yet, or the iframe window is momentarily unavailable: queue instead of losing
    // the command (Q-1, P-1).
    if (!state.ready || viewerWindow === null) {
      queue.push(command);
      setState({ queued: queue.length });
      notify(null);
      return;
    }
    // Never '*': the target origin is always the configured, hardcoded viewer origin (Q-2).
    viewerWindow.postMessage(command, viewerOrigin);
  }

  function subscribe(listener: BridgeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getState(): BridgeState {
    return state;
  }

  function dispose(): void {
    // Idempotent: a second call is a no-op instead of throwing or double-removing a listener.
    if (disposed) {
      return;
    }
    disposed = true;
    hostWindow.removeEventListener('message', handleMessage);
    queue.length = 0;
    listeners.clear();
    setState({ ready: false, queued: 0 });
  }

  return { send, subscribe, getState, dispose };
}
