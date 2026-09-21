import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import type { Channel, Disposable } from '@bdiadiun/scoring-channel';

// The host end of the channel: viewer events come in, host commands go out.
export type HostChannel = Channel<ViewerEvent, HostCommand>;

export interface OrchestratorState {
  ready: boolean;
  queued: number;
  lastEvent: ViewerEvent | null;
}

// One subscription channel for both events and state-only changes (queue length) instead of
// separate "onEvent"/"onStateChange" APIs; `event` is null for the latter.
export type OrchestratorListener = (event: ViewerEvent | null, state: OrchestratorState) => void;

export interface CreateOrchestratorOptions {
  // A function, not a value: the iframe element (and its window) can change or be briefly null
  // while React mounts it.
  getViewerWindow: () => Window | null;
  viewerOrigin: string;
  hostWindow?: Window;
  exchangeTimeoutMs?: number;
}

export interface Orchestrator extends Disposable {
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
  subscribe: (listener: OrchestratorListener) => () => void;
  getState: () => OrchestratorState;
}
