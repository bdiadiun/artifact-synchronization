import { isViewerEvent } from '@bdiadiun/scoring-contract';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { listenFrom } from '../shared/peer.js';
import type { Peer } from '../shared/peer.js';
import { createHostOutbox } from './outbox.js';
import type { ChannelState, HostOutbox } from './outbox.js';

export interface HostChannel {
  send: (command: HostCommand) => boolean;
  onEvent: (handle: (event: ViewerEvent) => void) => () => void;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

export interface HostChannelOptions {
  viewerOrigin: string;
  getViewerWindow: () => Window | null;
}

const ignoreEvent = (): void => undefined;

const armedRowAfter = (command: HostCommand, armedRowId: string | null): string | null => {
  if (command.type === 'ACTIVATE_TOOL') {
    return command.rowId;
  }
  if (command.type === 'DEACTIVATE_TOOL' && command.rowId === armedRowId) {
    return null;
  }
  return armedRowId;
};

const cancelArmedRow = (outbox: HostOutbox, armedRowId: string | null): void => {
  if (armedRowId !== null && outbox.getState().ready) {
    outbox.send({ type: 'DEACTIVATE_TOOL', rowId: armedRowId });
  }
};

export const createHostChannel = ({
  viewerOrigin,
  getViewerWindow,
}: HostChannelOptions): HostChannel => {
  const peer: Peer = { origin: viewerOrigin, getWindow: getViewerWindow };
  const outbox = createHostOutbox(peer);
  const { getState, subscribe } = outbox;
  let handle: (event: ViewerEvent) => void = ignoreEvent;
  let armedRowId: string | null = null;
  let disposed = false;

  const send = (command: HostCommand): boolean => {
    if (disposed) {
      return false;
    }
    armedRowId = armedRowAfter(command, armedRowId);
    return outbox.send(command);
  };

  const onEvent = (next: (event: ViewerEvent) => void): (() => void) => {
    handle = next;

    return () => {
      handle = ignoreEvent;
    };
  };

  const handleEvent = (event: ViewerEvent): void => {
    if (event.type === 'VIEWER_READY') {
      outbox.flush();
    }
    handle(event);
  };

  const stopListening = listenFrom(peer, isViewerEvent, handleEvent);

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    cancelArmedRow(outbox, armedRowId);
    stopListening();
    handle = ignoreEvent;
    outbox.clear();
  };

  return { send, onEvent, getState, subscribe, dispose };
};
