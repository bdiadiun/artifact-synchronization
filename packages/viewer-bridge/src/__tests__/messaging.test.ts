import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViewerReadyEvent } from '@bdiadiun/scoring-contract';

import { createCommandListener, createPostToHost } from '../messaging.js';

const HOST_ORIGIN = 'https://form.example.com';

const readyEvent: ViewerReadyEvent = { version: 1, type: 'VIEWER_READY', viewerVersion: '1.0.0' };

const activateTool = {
  version: 1,
  type: 'ACTIVATE_TOOL',
  requestId: 'req-1',
  rowId: 'row-1',
  toolName: 'EllipticalROI',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPostToHost', () => {
  it('posts the message to the configured host origin, never a wildcard', () => {
    const postMessage = vi.fn();
    vi.spyOn(window, 'parent', 'get').mockReturnValue({ postMessage } as unknown as Window);

    const postToHost = createPostToHost(HOST_ORIGIN);
    const result = postToHost(readyEvent);

    expect(result).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(readyEvent, HOST_ORIGIN);
    expect(postMessage).not.toHaveBeenCalledWith(readyEvent, '*');
  });

  it('returns false and does not post when the page is not framed', () => {
    vi.spyOn(window, 'parent', 'get').mockReturnValue(window);

    const postToHost = createPostToHost(HOST_ORIGIN);
    const result = postToHost(readyEvent);

    expect(result).toBe(false);
  });
});

describe('createCommandListener', () => {
  it('passes a valid command from the configured origin through exactly once', () => {
    const onCommand = vi.fn();
    createCommandListener({ hostOrigin: HOST_ORIGIN, onCommand });

    window.dispatchEvent(new MessageEvent('message', { data: activateTool, origin: HOST_ORIGIN }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(activateTool);
  });

  it('ignores a message from any other origin', () => {
    const onCommand = vi.fn();
    createCommandListener({ hostOrigin: HOST_ORIGIN, onCommand });

    window.dispatchEvent(
      new MessageEvent('message', { data: activateTool, origin: 'https://evil.example.com' }),
    );

    expect(onCommand).not.toHaveBeenCalled();
  });

  it('ignores a payload the contract guard rejects', () => {
    const onCommand = vi.fn();
    createCommandListener({ hostOrigin: HOST_ORIGIN, onCommand });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...activateTool, requestId: 42 },
        origin: HOST_ORIGIN,
      }),
    );

    expect(onCommand).not.toHaveBeenCalled();
  });

  it('removes its listener on dispose', () => {
    const onCommand = vi.fn();
    const listener = createCommandListener({ hostOrigin: HOST_ORIGIN, onCommand });

    listener.dispose();
    window.dispatchEvent(new MessageEvent('message', { data: activateTool, origin: HOST_ORIGIN }));

    expect(onCommand).not.toHaveBeenCalled();
  });
});
