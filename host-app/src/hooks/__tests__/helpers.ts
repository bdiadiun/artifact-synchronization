// Shared test doubles for the hook tests in this folder: a real `createHostChannel` (A-22) paired
// with a fake viewer window, so a test drives the channel exactly as `useHostChannel` does, and a
// helper to dispatch an incoming viewer message on the real jsdom `window`.

import { vi } from 'vitest';
import { createHostChannel, type HostChannel } from '@bdiadiun/scoring-channel';
import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import { VIEWER_ORIGIN } from '@app/config';

export interface FakeViewerWindow {
  postMessage: ReturnType<typeof vi.fn>;
}

export interface ChannelHarness {
  channel: HostChannel;
  viewerWindow: FakeViewerWindow;
  posted: () => HostCommand[];
}

// Tracked so a test file's `afterEach` can dispose every channel it created: these channels are
// not tied to a component's lifecycle, and jsdom's `window` is shared across the tests in one file.
const createdChannels: HostChannel[] = [];

export const disposeAllHarnessChannels = (): void => {
  for (const channel of createdChannels.splice(0)) {
    channel.dispose();
  }
};

export const createChannelHarness = (): ChannelHarness => {
  const viewerWindow: FakeViewerWindow = { postMessage: vi.fn() };
  const channel = createHostChannel({
    viewerOrigin: VIEWER_ORIGIN,
    getViewerWindow: () => viewerWindow as unknown as Window,
  });
  createdChannels.push(channel);

  return {
    channel,
    viewerWindow,
    posted: (): HostCommand[] =>
      viewerWindow.postMessage.mock.calls.map(([message]) => message as HostCommand),
  };
};

export const dispatchFromViewer = (data: ViewerEvent, origin = VIEWER_ORIGIN): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};
