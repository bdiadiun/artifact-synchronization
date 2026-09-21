import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';

export interface OrchestratorState {
  ready: boolean;
  queued: number;
  lastEvent: ViewerEvent | null;
  ignoredOrigins: number;
}

// One subscription channel for both events and state-only changes (queue length, origin-ignore
// count) instead of separate "onEvent"/"onStateChange" APIs; `event` is null for the latter.
export type OrchestratorListener = (event: ViewerEvent | null, state: OrchestratorState) => void;

export interface CreateOrchestratorOptions {
  // A function, not a value: the iframe element (and its window) can change or be briefly null
  // while React mounts it.
  getViewerWindow: () => Window | null;
  viewerOrigin: string;
  hostWindow?: Window;
}

export interface Orchestrator {
  send: (command: HostCommand) => void;
  subscribe: (listener: OrchestratorListener) => () => void;
  getState: () => OrchestratorState;
  dispose: () => void;
}
