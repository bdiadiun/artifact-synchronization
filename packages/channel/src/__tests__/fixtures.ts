// Shared test doubles for the channel's own tests. Neither end's channel takes an injected
// window any more (A-22): both listen on the real jsdom `window`, so incoming traffic is
// dispatched there; what each end injects is only its peer, a fake `{ postMessage }` window.

import { vi } from 'vitest';
import type {
  ActivateToolCommand,
  DeactivateToolCommand,
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  ViewerEvent,
  ViewerReadyEvent,
} from '@bdiadiun/scoring-contract';
import { createHostChannel } from '../hostChannel';
import type { HostChannel } from '../hostChannel';
import { createViewerChannel } from '../viewerChannel';
import type { ViewerChannel } from '../viewerChannel';

export const HOST_ORIGIN = 'http://localhost:5173';
export const VIEWER_ORIGIN = 'http://localhost:3000';

export interface FakePeerWindow {
  postMessage: ReturnType<typeof vi.fn>;
}

export const createFakePeerWindow = (): FakePeerWindow => ({ postMessage: vi.fn() });

export const dispatchMessage = (data: unknown, origin: string): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

// Tracked so a test file's `afterEach` can release every listener the fixtures created: jsdom's
// `window` is shared across the tests in one file, and a channel left live would still be
// listening when the next test dispatches on it.
const createdChannels: { dispose: () => void }[] = [];

export const disposeAllFixtureChannels = (): void => {
  for (const channel of createdChannels.splice(0)) {
    channel.dispose();
  }
};

export interface HostChannelFixture {
  channel: HostChannel;
  viewerWindow: FakePeerWindow;
  posted: () => HostCommand[];
}

export const createHostChannelFixture = (): HostChannelFixture => {
  const viewerWindow = createFakePeerWindow();
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

export interface ViewerChannelFixtureOptions {
  framed?: boolean;
}

export interface ViewerChannelFixture {
  channel: ViewerChannel;
  hostWindow: FakePeerWindow;
  posted: () => ViewerEvent[];
}

// The viewer's peer window is not injected: `createViewerChannel` reads `window.parent` itself
// (A-22), so a framed viewer is simulated by mocking that getter.
export const createViewerChannelFixture = ({
  framed = true,
}: ViewerChannelFixtureOptions = {}): ViewerChannelFixture => {
  const hostWindow = createFakePeerWindow();
  vi.spyOn(window, 'parent', 'get').mockReturnValue(
    (framed ? hostWindow : window) as unknown as Window,
  );
  const channel = createViewerChannel({ hostOrigin: HOST_ORIGIN });
  createdChannels.push(channel);

  return {
    channel,
    hostWindow,
    posted: (): ViewerEvent[] =>
      hostWindow.postMessage.mock.calls.map(([message]) => message as ViewerEvent),
  };
};

// What a peer actually posts (A-25): a contract message plus the version the sending channel
// stamps on it. The builders below produce incoming traffic, so they carry that version.
export type WireMessage<TMessage> = TMessage & { version: number };

export const viewerReadyMessage = (viewerVersion = '1.0.0'): WireMessage<ViewerReadyEvent> => ({
  version: 1,
  type: 'VIEWER_READY',
  viewerVersion,
});

export const activateToolMessage = (
  rowId: string,
  requestId = 'req-1',
): WireMessage<ActivateToolCommand> => ({
  version: 1,
  type: 'ACTIVATE_TOOL',
  requestId,
  rowId,
  toolName: 'EllipticalROI',
});

export const deactivateToolMessage = (
  rowId: string,
  requestId = 'req-2',
): WireMessage<DeactivateToolCommand> => ({
  version: 1,
  type: 'DEACTIVATE_TOOL',
  requestId,
  rowId,
});

export const measurementAddedMessage = (
  rowId: string | null,
  overrides: Partial<MeasurementAddedEvent> = {},
): WireMessage<MeasurementAddedEvent> => ({
  version: 1,
  type: 'MEASUREMENT_ADDED',
  rowId,
  measurementUid: 'uid-1',
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  ...overrides,
});

export const measurementRemovedMessage = (
  measurementUid: string,
  overrides: Partial<MeasurementRemovedEvent> = {},
): WireMessage<MeasurementRemovedEvent> => ({
  version: 1,
  type: 'MEASUREMENT_REMOVED',
  measurementUid,
  ...overrides,
});
