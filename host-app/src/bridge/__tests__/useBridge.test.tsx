import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, useRef, type JSX } from 'react';
import { render, cleanup } from '@testing-library/react';
import { useBridge } from '../useBridge';

const Harness = (): JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useBridge(iframeRef);
  return <iframe ref={iframeRef} title="viewer" />;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useBridge', () => {
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

  it('removes the listener entirely on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<Harness />);
    unmount();

    const removed = removeSpy.mock.calls.filter((call) => call[0] === 'message').length;
    expect(removed).toBe(1);
  });
});
