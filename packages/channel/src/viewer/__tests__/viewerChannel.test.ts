// The viewer end is transport only (A-29): it posts the event it is handed and gives every command
// that survives the guard to the one handler the bridge registered. Origin, the contract guard and
// the contract version are exercised once in channel.test.ts and not repeated here.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activateToolMessage,
  createViewerChannelFixture,
  deactivateToolMessage,
  disposeAllFixtureChannels,
  dispatchMessage,
  HOST_ORIGIN,
} from '../../shared/__tests__/fixtures';

afterEach(() => {
  disposeAllFixtureChannels();
  vi.restoreAllMocks();
});

describe('the command handler the bridge registers', () => {
  it('receives every host command, whatever its type', () => {
    const { channel } = createViewerChannelFixture();
    const handle = vi.fn();
    channel.onCommand(handle);

    dispatchMessage(activateToolMessage('row-1'), HOST_ORIGIN);
    dispatchMessage(deactivateToolMessage('row-1'), HOST_ORIGIN);

    expect(handle).toHaveBeenCalledTimes(2);
    expect(handle).toHaveBeenNthCalledWith(1, {
      type: 'ACTIVATE_TOOL',
      rowId: 'row-1',
      toolName: 'EllipticalROI',
      version: 1,
    });
    expect(handle).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId: 'row-1' }),
    );
  });

  it('is replaced by the handler registered after it', () => {
    const { channel } = createViewerChannelFixture();
    const replaced = vi.fn();
    const current = vi.fn();
    channel.onCommand(replaced);

    channel.onCommand(current);
    dispatchMessage(activateToolMessage('row-1'), HOST_ORIGIN);

    expect(replaced).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
  });

  it('receives nothing once the channel is disposed', () => {
    const { channel } = createViewerChannelFixture();
    const handle = vi.fn();
    channel.onCommand(handle);

    channel.dispose();
    dispatchMessage(activateToolMessage('row-1'), HOST_ORIGIN);

    expect(handle).not.toHaveBeenCalled();
  });
});

describe('what the viewer end posts', () => {
  it('posts the event it was handed, unchanged but for the version', () => {
    const { channel, posted } = createViewerChannelFixture();

    const delivered = channel.send({ type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1' });

    expect(delivered).toBe(true);
    expect(posted()).toEqual([
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1' },
    ]);
  });

  it('reports failure and posts nothing when the viewer is not framed', () => {
    const { channel, hostWindow } = createViewerChannelFixture({ framed: false });

    const delivered = channel.send({ type: 'VIEWER_READY', viewerVersion: '3.12.17' });

    expect(delivered).toBe(false);
    expect(hostWindow.postMessage).not.toHaveBeenCalled();
  });
});
