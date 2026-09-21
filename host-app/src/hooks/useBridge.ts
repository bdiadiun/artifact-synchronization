import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  createOrchestrator,
  type HostChannel,
  type Orchestrator,
  type OrchestratorState,
} from '@bdiadiun/scoring-orchestrator';
import { VIEWER_ORIGIN } from '@app/config';

export interface UseBridgeResult {
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
  state: OrchestratorState;
}

const INITIAL_STATE: OrchestratorState = {
  ready: false,
  queued: 0,
  lastEvent: null,
  ignoredOrigins: 0,
};

// One orchestrator instance per mount, disposed on unmount; under StrictMode's dev double-mount, the
// first mount's cleanup runs before the second mount attaches, so only one listener is ever live.
export const useBridge = (iframeRef: RefObject<HTMLIFrameElement | null>): UseBridgeResult => {
  const [state, setState] = useState<OrchestratorState>(INITIAL_STATE);
  const orchestratorRef = useRef<Orchestrator | null>(null);

  useEffect(() => {
    const orchestrator = createOrchestrator({
      // Read lazily: the iframe can be briefly null and its window is a live value (P-1).
      getViewerWindow: () => iframeRef.current?.contentWindow ?? null,
      viewerOrigin: VIEWER_ORIGIN,
    });
    orchestratorRef.current = orchestrator;
    setState(orchestrator.getState());
    const unsubscribe = orchestrator.subscribe((_event, nextState) => {
      setState(nextState);
    });

    return () => {
      unsubscribe();
      orchestrator.dispose();
      orchestratorRef.current = null;
    };
    // `iframeRef` and `VIEWER_ORIGIN` are stable, so this effect runs once per mount.
  }, [iframeRef]);

  const send: HostChannel['send'] = (type, payload) =>
    orchestratorRef.current?.send(type, payload) ?? false;

  const exchange: HostChannel['exchange'] = (type, payload) => {
    const orchestrator = orchestratorRef.current;
    if (orchestrator === null) {
      return Promise.reject(new Error(`[form] ${type} was not sent: the bridge is not mounted`));
    }
    return orchestrator.exchange(type, payload);
  };

  return { send, exchange, state };
};
