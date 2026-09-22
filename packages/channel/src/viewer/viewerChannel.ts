import { isHostCommand } from '@bdiadiun/scoring-contract';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { listenFrom, postTo } from '../shared/peer.js';
import type { Peer } from '../shared/peer.js';

export interface ViewerChannel {
  send: (event: ViewerEvent) => boolean;
  onCommand: (handle: (command: HostCommand) => void) => void;
  dispose: () => void;
}

export interface ViewerChannelOptions {
  hostOrigin: string;
}

const getHostWindow = (): Window | null => (window.parent === window ? null : window.parent);

const ignoreCommand = (): void => undefined;

export const createViewerChannel = ({ hostOrigin }: ViewerChannelOptions): ViewerChannel => {
  const peer: Peer = { origin: hostOrigin, getWindow: getHostWindow };
  let handle: (command: HostCommand) => void = ignoreCommand;

  const send = (event: ViewerEvent): boolean => postTo(peer, event);

  const onCommand = (next: (command: HostCommand) => void): void => {
    handle = next;
  };

  const stopListening = listenFrom(peer, isHostCommand, (command) => {
    handle(command);
  });

  const dispose = (): void => {
    stopListening();
    handle = ignoreCommand;
  };

  return { send, onCommand, dispose };
};
