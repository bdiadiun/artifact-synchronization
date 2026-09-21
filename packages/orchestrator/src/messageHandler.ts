// The orchestrator's `message` listener: origin check, payload guard, viewer-event dispatch
// (Q-2, A-9).

import { isViewerEvent, type ViewerReadyEvent } from '@bdiadiun/scoring-contract';
import type { MessageHandlerDeps } from './messageHandler.props';

export type { MessageHandlerDeps } from './messageHandler.props';

export const createMessageHandler = (deps: MessageHandlerDeps): ((event: MessageEvent) => void) => {
  // Logged once per foreign origin, not once per message.
  const loggedOrigins = new Set<string>();

  const handleForeignOrigin = (origin: string): void => {
    deps.setState({ ignoredOrigins: deps.getState().ignoredOrigins + 1 });
    if (!loggedOrigins.has(origin)) {
      loggedOrigins.add(origin);
      console.debug('[bridge] ignoring message from foreign origin', origin);
    }
    deps.notify(null);
  };

  // A second READY means a reload (A-9): flip ready false-then-true so subscribers can observe the
  // edge (e.g. re-arm a row stuck in "Drawing…"), then flush what queued up.
  const handleViewerReady = (event: ViewerReadyEvent): void => {
    if (deps.getState().ready) {
      deps.setState({ ready: false });
      deps.notify(event);
    }
    deps.setState({ ready: true, lastEvent: event });
    deps.notify(event);
    deps.flushQueue();
  };

  return (event: MessageEvent): void => {
    // Origin check (Q-2): never trust the payload to say who sent it.
    if (event.origin !== deps.viewerOrigin) {
      handleForeignOrigin(event.origin);
      return;
    }
    if (!isViewerEvent(event.data)) {
      console.warn('[bridge] ignoring malformed payload of type', typeof event.data);
      return;
    }
    const viewerEvent = event.data;
    if (viewerEvent.type === 'VIEWER_READY') {
      handleViewerReady(viewerEvent);
      return;
    }
    deps.setState({ lastEvent: viewerEvent });
    deps.notify(viewerEvent);
  };
};
