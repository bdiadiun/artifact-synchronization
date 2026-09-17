import { useEffect, useRef, useState, type RefObject } from 'react';
import type { HostCommand } from '@scoring/contract';
import { createBridge, type Bridge, type BridgeState } from './createBridge';
import { VIEWER_ORIGIN } from '../config';

export interface UseBridgeResult {
  send: (command: HostCommand) => void;
  state: BridgeState;
}

const INITIAL_STATE: BridgeState = { ready: false, queued: 0, lastEvent: null, ignoredOrigins: 0 };

// One bridge instance per mount, disposed on unmount; under StrictMode's dev double-mount, the
// first mount's cleanup runs before the second mount attaches, so only one listener is ever live.
export const useBridge = (iframeRef: RefObject<HTMLIFrameElement | null>): UseBridgeResult => {
  const [state, setState] = useState<BridgeState>(INITIAL_STATE);
  const bridgeRef = useRef<Bridge | null>(null);

  useEffect(() => {
    const bridge = createBridge({
      // Read lazily: the iframe can be briefly null and its window is a live value (P-1).
      getViewerWindow: () => iframeRef.current?.contentWindow ?? null,
      viewerOrigin: VIEWER_ORIGIN,
    });
    bridgeRef.current = bridge;
    setState(bridge.getState());
    const unsubscribe = bridge.subscribe((_event, nextState) => {
      setState(nextState);
    });

    return () => {
      unsubscribe();
      bridge.dispose();
      bridgeRef.current = null;
    };
    // `iframeRef` and `VIEWER_ORIGIN` are stable, so this effect runs once per mount.
  }, [iframeRef]);

  const send = (command: HostCommand): void => {
    bridgeRef.current?.send(command);
  };

  return { send, state };
};
