// The way in: the host end of the channel, configured once with the origin it accepts and the
// contract guard that admits an event (A-21), and what an admitted event does to the state (A-9).
// The origin check and the guard are the channel's; by the time the handler runs the event is
// trusted.

import { isViewerEvent } from '@bdiadiun/scoring-contract';
import { createChannel } from '@bdiadiun/scoring-channel';
import type { HostCommand, ViewerEvent, ViewerReadyEvent } from '@bdiadiun/scoring-contract';
import { LOG_PREFIX } from './config';
import type { HostChannel } from './createOrchestrator.props';
import type { StateStore } from './orchestratorState';
import type { CommandDelivery } from './outgoingCommands.props';

export interface HostChannelDeps {
  viewerOrigin: string;
  hostWindow: Window;
  exchangeTimeoutMs?: number;
  deliver: CommandDelivery;
}

export interface ViewerEventDeps {
  store: StateStore;
  flushQueue: () => void;
}

export type ViewerEventHandler = (event: ViewerEvent) => void;

export const createHostChannel = ({
  viewerOrigin,
  hostWindow,
  exchangeTimeoutMs,
  deliver,
}: HostChannelDeps): HostChannel =>
  createChannel<ViewerEvent, HostCommand>({
    peerOrigin: viewerOrigin,
    isIncoming: isViewerEvent,
    deliver,
    localWindow: hostWindow,
    logPrefix: LOG_PREFIX,
    exchangeTimeoutMs,
  });

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
