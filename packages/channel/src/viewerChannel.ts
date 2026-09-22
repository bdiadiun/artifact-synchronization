// The viewer end (A-21): host commands come in, viewer events go out to the window embedding the
// viewer. Nothing is held back here, because the host is listening before the viewer loads.

import { isHostCommand } from '@bdiadiun/scoring-contract';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { createChannel } from './createChannel.js';
import type { Channel } from './createChannel.props.js';

export type ViewerChannel = Channel<HostCommand, ViewerEvent>;

export interface ViewerChannelOptions {
  hostOrigin: string;
}

// The host is the window embedding the viewer; a viewer opened directly has nobody to answer.
const getHostWindow = (): Window | null => (window.parent === window ? null : window.parent);

export const createViewerChannel = ({ hostOrigin }: ViewerChannelOptions): ViewerChannel =>
  createChannel<HostCommand, ViewerEvent>({
    peer: { origin: hostOrigin, getWindow: getHostWindow },
    isIncoming: isHostCommand,
  });
