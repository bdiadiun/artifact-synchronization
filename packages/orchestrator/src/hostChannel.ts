// The host end of the channel, configured once: the viewer origin it accepts, the contract guard
// that admits an event and the delivery the queue gates (A-21).

import { isViewerEvent } from '@bdiadiun/scoring-contract';
import { createChannel } from '@bdiadiun/scoring-channel';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { LOG_PREFIX } from './config';
import type { HostChannel } from './createOrchestrator.props';
import type { HostChannelDeps } from './hostChannel.props';

export const createHostChannel = ({
  viewerOrigin,
  hostWindow,
  exchangeTimeoutMs,
  deliver,
  onIgnoredOrigin,
}: HostChannelDeps): HostChannel =>
  createChannel<ViewerEvent, HostCommand>({
    peerOrigin: viewerOrigin,
    isIncoming: isViewerEvent,
    deliver,
    localWindow: hostWindow,
    logPrefix: LOG_PREFIX,
    exchangeTimeoutMs,
    onIgnoredOrigin,
  });
