// What an incoming viewer event does to orchestrator state (A-9). The origin check and the contract
// guard are the channel's; by the time this runs the event is trusted.

import type { ViewerEvent, ViewerReadyEvent } from '@bdiadiun/scoring-contract';
import type { ViewerEventDeps, ViewerEventHandler } from './viewerEvents.props';

export type { ViewerEventDeps, ViewerEventHandler } from './viewerEvents.props';

export const createViewerEventHandler = ({
  store,
  flushQueue,
}: ViewerEventDeps): ViewerEventHandler => {
  // A second READY means a reload (A-9): flip ready false-then-true so subscribers can observe the
  // edge (e.g. re-arm a row stuck in "Drawing…"), then flush what queued up.
  const handleViewerReady = (event: ViewerReadyEvent): void => {
    if (store.get().ready) {
      store.patch({ ready: false });
      store.notify(event);
    }
    store.patch({ ready: true, lastEvent: event });
    store.notify(event);
    flushQueue();
  };

  return (event: ViewerEvent): void => {
    if (event.type === 'VIEWER_READY') {
      handleViewerReady(event);
      return;
    }
    store.patch({ lastEvent: event });
    store.notify(event);
  };
};
