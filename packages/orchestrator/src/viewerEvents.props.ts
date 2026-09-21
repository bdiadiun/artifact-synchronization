import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { StateStore } from './orchestratorState.props';

export interface ViewerEventDeps {
  store: StateStore;
  flushQueue: () => void;
}

export type ViewerEventHandler = (event: ViewerEvent) => void;
