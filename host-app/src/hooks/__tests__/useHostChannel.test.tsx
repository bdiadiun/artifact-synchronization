import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, useEffect, useRef, type JSX } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ChannelState, HostChannel } from '@bdiadiun/scoring-channel';
import { VIEWER_ORIGIN } from '@app/config';
import { useChannelState } from '@app/hooks/useChannelState';
import { useHostChannel } from '@app/hooks/useHostChannel';
import { dispatchFromViewer } from './helpers';

interface Captured {
  channel: HostChannel | null;
  state: ChannelState;
}

// A plain module-level box, written from an effect (not from the render body, which must stay
// pure) so a test can reach the hook's return value without a component tree of its own.
const capturedRef: { current: Captured | null } = { current: null };

const Harness = (): JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const channel = useHostChannel(iframeRef);
  const state = useChannelState(channel);
  useEffect(() => {
    capturedRef.current = { channel, state };
  });
  return <iframe ref={iframeRef} title="viewer" />;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  capturedRef.current = null;
});

describe('useHostChannel', () => {
  it('leaves exactly one net "message" listener after a StrictMode double-mount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );

    const added = addSpy.mock.calls.filter((call) => call[0] === 'message').length;
    const removed = removeSpy.mock.calls.filter((call) => call[0] === 'message').length;
    expect(added - removed).toBe(1);
  });

  it('disposes the channel and removes the listener entirely on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<Harness />);
    unmount();

    const removed = removeSpy.mock.calls.filter((call) => call[0] === 'message').length;
    expect(removed).toBe(1);
  });

  it('reports state that follows the channel: not ready with nothing queued, then ready after VIEWER_READY', () => {
    render(<Harness />);
    expect(capturedRef.current?.state).toEqual({ ready: false, queued: 0 });

    act(() => {
      dispatchFromViewer({ type: 'VIEWER_READY', viewerVersion: '1.0.0' });
    });

    expect(capturedRef.current?.state).toEqual({ ready: true, queued: 0 });
  });

  // Q-5: the hook disposes in a layout cleanup, while the iframe and its ref are still mounted.
  it('cancels the armed tool on unmount, posting DEACTIVATE_TOOL to the viewer window', () => {
    const { unmount } = render(<Harness />);
    const iframe = screen.getByTitle('viewer');
    const contentWindow = (iframe as HTMLIFrameElement).contentWindow;
    if (contentWindow === null) {
      throw new Error('the rendered iframe has no contentWindow');
    }
    const postMessageSpy = vi.spyOn(contentWindow, 'postMessage');
    act(() => {
      dispatchFromViewer({ type: 'VIEWER_READY', viewerVersion: '1.0.0' });
    });
    act(() => {
      capturedRef.current?.channel?.send('ACTIVATE_TOOL', {
        rowId: 'row-1',
        toolName: 'EllipticalROI',
      });
    });
    postMessageSpy.mockClear();

    unmount();

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId: 'row-1' }),
      VIEWER_ORIGIN,
    );
  });
});
