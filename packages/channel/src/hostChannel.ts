// The host end (A-9, A-21). The channel itself holds commands until VIEWER_READY and publishes the
// queue; what is host-only is the row the viewer is armed with, cancelled on unmount while the
// channel is still live (Q-5).

import { isViewerEvent } from '@bdiadiun/scoring-contract';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { createChannel } from './createChannel.js';
import type { Channel } from './createChannel.props.js';

export type HostChannel = Channel<ViewerEvent, HostCommand>;

export interface HostChannelOptions {
  viewerOrigin: string;
  getViewerWindow: () => Window | null;
}

export const createHostChannel = ({
  viewerOrigin,
  getViewerWindow,
}: HostChannelOptions): HostChannel => {
  const channel = createChannel<ViewerEvent, HostCommand>({
    peer: { origin: viewerOrigin, getWindow: getViewerWindow },
    isIncoming: isViewerEvent,
    holdUntil: 'VIEWER_READY',
  });

  let armedRowId: string | null = null;
  let disposed = false;

  // The host sends every command, so this is the one place that knows which row the viewer is
  // still armed with. `type` says which command this is, but the compiler keeps the payload union
  // open, so the row is read from the payload by name rather than by narrowing.
  const rememberArmedRow = (type: HostCommand['type'], payload: object): void => {
    if (type !== 'ACTIVATE_TOOL' && type !== 'DEACTIVATE_TOOL') {
      return;
    }
    const rowId = 'rowId' in payload ? payload.rowId : null;
    armedRowId = type === 'ACTIVATE_TOOL' && typeof rowId === 'string' ? rowId : null;
  };

  return {
    ...channel,

    send: (type, payload) => {
      if (disposed) {
        return false;
      }
      rememberArmedRow(type, payload);
      return channel.send(type, payload);
    },

    dispose: (): void => {
      if (disposed) {
        return;
      }
      // Q-5: sent through the still-live channel. A viewer that never became ready has nothing
      // armed to cancel.
      if (armedRowId !== null && channel.getState().ready) {
        channel.send('DEACTIVATE_TOOL', { rowId: armedRowId });
      }
      disposed = true;
      channel.dispose();
    },
  };
};
