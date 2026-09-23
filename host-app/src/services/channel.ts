import { isViewerEvent, type ViewerEvent } from '@bdiadiun/scoring-contract';
import { createChannel, type Channel } from '@bdiadiun/scoring-channel';
import { VIEWER_ORIGIN } from '@app/config';

export type HostChannel = Channel<ViewerEvent>;

// One channel for the page, alive as long as the page: the viewer is this page's iframe, and its
// window is learnt from its own VIEWER_READY, so nothing here refers to the iframe. What a hook
// subscribes, the hook unsubscribes (Q-5); the channel itself has nothing outside the page to release.
export const channel: HostChannel = createChannel({
  peerOrigin: VIEWER_ORIGIN,
  accept: isViewerEvent,
  readyOn: 'VIEWER_READY',
});
