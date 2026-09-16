// React binding for the framework-free bridge (canon Q-5). Kept separate from `createBridge.ts`
// so the bridge itself stays testable without React and reusable if the iframe wiring changes.

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { HostCommand } from '@scoring/contract';
import { createBridge, type Bridge, type BridgeState } from './createBridge';
import { VIEWER_ORIGIN } from '../config';

export interface UseBridgeResult {
  send: (command: HostCommand) => void;
  state: BridgeState;
}

const INITIAL_STATE: BridgeState = { ready: false, queued: 0, lastEvent: null, ignoredOrigins: 0 };

// Creates one bridge instance per mount, tied to the given iframe ref, and disposes it on
// unmount (Q-5: paired addEventListener/removeEventListener, no leaked subscription). Under
// StrictMode's mount-unmount-mount dev cycle this runs twice, but the cleanup from the first
// mount tears its listener down before the second mount adds a new one, so exactly one
// `message` listener is ever attached at a time.
export function useBridge(iframeRef: RefObject<HTMLIFrameElement | null>): UseBridgeResult {
  const [state, setState] = useState<BridgeState>(INITIAL_STATE);
  const bridgeRef = useRef<Bridge | null>(null);

  useEffect(() => {
    const bridge = createBridge({
      // Read the iframe's contentWindow lazily, not at effect-setup time: the iframe can still
      // be null briefly, and its window is a live value, not a snapshot (P-1).
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
    // `iframeRef` is a ref object with a stable identity across renders, and `VIEWER_ORIGIN` is
    // a module-level constant, so this effect intentionally runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeRef]);

  function send(command: HostCommand): void {
    bridgeRef.current?.send(command);
  }

  return { send, state };
}
