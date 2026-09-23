// Shared test doubles: the page's one channel posts to the window it learnt from VIEWER_READY, so
// a test dispatches viewer events with jsdom's `window` as their source and reads what was posted
// back to it from a spy on `window.postMessage`.

import { vi } from 'vitest';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { VIEWER_ORIGIN } from '@app/config';

export interface ChannelHarness {
  posted: () => HostCommand[];
  clearPosted: () => void;
}

export const disposeAllHarnessChannels = (): void => {
  vi.restoreAllMocks();
};

export const createChannelHarness = (): ChannelHarness => {
  const spy = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined);

  return {
    posted: (): HostCommand[] => spy.mock.calls.map(([message]) => message as HostCommand),
    clearPosted: (): void => {
      spy.mockClear();
    },
  };
};

// The contract version lives on the wire, not in the message types (A-25), so it is stamped here
// the way the viewer's channel stamps it; without it the host's channel drops the event.
export const dispatchFromViewer = (event: ViewerEvent, origin = VIEWER_ORIGIN): void => {
  window.dispatchEvent(
    new MessageEvent('message', { data: { version: 1, ...event }, origin, source: window }),
  );
};
