// The host end's own behaviour on top of the generic channel (A-22): the queue held until
// VIEWER_READY, and cancelling the armed row on dispose while the channel is still live (Q-1,
// Q-5). Origin, the contract guard and the exchange mechanics are exercised once in
// channel.test.ts and not repeated here.
//
// Dropped from the old orchestrator suite, not ported: `lastEvent` and the notification count it
// drove no longer exist (A-22); the false -> true `ready` flip the old suite counted on a second
// READY never happened here either, because `ready` only ever moves from false to true once.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostChannel } from '../hostChannel';
import {
  createHostChannelFixture,
  disposeAllFixtureChannels,
  dispatchMessage,
  VIEWER_ORIGIN,
  viewerReadyMessage,
} from '../../shared/__tests__/fixtures';

afterEach(() => {
  disposeAllFixtureChannels();
});

describe('the queue held until VIEWER_READY', () => {
  it('queues a command sent before VIEWER_READY instead of posting it', () => {
    const { channel, viewerWindow } = createHostChannelFixture();

    const delivered = channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });

    expect(delivered).toBe(false);
    expect(viewerWindow.postMessage).not.toHaveBeenCalled();
    expect(channel.getState()).toEqual({ ready: false, queued: 1 });
  });

  it('flushes the queue in FIFO order on VIEWER_READY, each with the exact target origin', () => {
    const { channel, viewerWindow } = createHostChannelFixture();

    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    channel.send('DEACTIVATE_TOOL', { rowId: 'row-1' });

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    expect(viewerWindow.postMessage).toHaveBeenCalledTimes(2);
    expect(viewerWindow.postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'ACTIVATE_TOOL', rowId: 'row-1' }),
      VIEWER_ORIGIN,
    );
    expect(viewerWindow.postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'DEACTIVATE_TOOL', rowId: 'row-1' }),
      VIEWER_ORIGIN,
    );
    expect(channel.getState()).toEqual({ ready: true, queued: 0 });
  });

  it('sends a command immediately once ready, without queuing it', () => {
    const { channel, viewerWindow } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    const delivered = channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });

    expect(delivered).toBe(true);
    expect(viewerWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(channel.getState().queued).toBe(0);
  });

  it('keeps the remainder queued when the viewer window disappears mid-flush, instead of dropping it', () => {
    let viewerWindowAvailable = true;
    const viewerWindow = { postMessage: vi.fn() };
    const channel = createHostChannel({
      viewerOrigin: VIEWER_ORIGIN,
      getViewerWindow: () => (viewerWindowAvailable ? (viewerWindow as unknown as Window) : null),
    });
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    channel.send('DEACTIVATE_TOOL', { rowId: 'row-1' });
    viewerWindow.postMessage.mockImplementationOnce(() => {
      viewerWindowAvailable = false;
    });

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    expect(viewerWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(channel.getState()).toEqual({ ready: true, queued: 1 });

    channel.dispose();
  });

  it('flushes the queue before the application handler for VIEWER_READY runs', () => {
    const { channel } = createHostChannelFixture();
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    const stateSeenByHandler: { ready: boolean; queued: number }[] = [];
    channel.on('VIEWER_READY', () => {
      stateSeenByHandler.push(channel.getState());
    });

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    expect(stateSeenByHandler).toEqual([{ ready: true, queued: 0 }]);
  });

  it('reaches the application handler again on a second VIEWER_READY (a viewer reload)', () => {
    const { channel } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    expect(onReady).toHaveBeenCalledTimes(2);
  });
});

describe('state and subscription', () => {
  it('returns the same state reference across calls until something changes', () => {
    const { channel } = createHostChannelFixture();

    const first = channel.getState();
    const second = channel.getState();

    expect(second).toBe(first);
  });

  it('notifies a subscriber when the queue grows and again when it becomes ready', () => {
    const { channel } = createHostChannelFixture();
    const listener = vi.fn();
    channel.subscribe(listener);

    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    expect(listener).toHaveBeenCalledTimes(1);

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('resets to not-ready with an empty queue once disposed', () => {
    const { channel } = createHostChannelFixture();
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });

    channel.dispose();

    expect(channel.getState()).toEqual({ ready: false, queued: 0 });
  });
});

describe('cancelling the armed row on dispose (Q-5)', () => {
  it('sends one DEACTIVATE_TOOL for the armed row through the still-live channel', () => {
    const { channel, viewerWindow } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    viewerWindow.postMessage.mockClear();

    channel.dispose();

    expect(viewerWindow.postMessage).toHaveBeenCalledTimes(1);
    const [posted, targetOrigin] = viewerWindow.postMessage.mock.calls[0] as [unknown, string];
    expect(posted).toMatchObject({ type: 'DEACTIVATE_TOOL', rowId: 'row-1' });
    expect(targetOrigin).toBe(VIEWER_ORIGIN);
  });

  it('sends the DEACTIVATE_TOOL before the underlying listener is removed', () => {
    const { channel, viewerWindow } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    viewerWindow.postMessage.mockClear();
    const order: string[] = [];
    viewerWindow.postMessage.mockImplementation(() => order.push('DEACTIVATE_TOOL posted'));
    const originalRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'removeEventListener').mockImplementation((...args) => {
      if (args[0] === 'message') {
        order.push('listener removed');
      }
      originalRemove(...(args as Parameters<typeof window.addEventListener>));
    });

    channel.dispose();

    expect(order).toEqual(['DEACTIVATE_TOOL posted', 'listener removed']);
  });

  it('sends nothing on dispose when the viewer never became ready, even if a row was armed', () => {
    const { channel, viewerWindow } = createHostChannelFixture();
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    viewerWindow.postMessage.mockClear();

    channel.dispose();

    expect(viewerWindow.postMessage).not.toHaveBeenCalled();
  });

  it('sends nothing on dispose when the armed row was already deactivated', () => {
    const { channel, viewerWindow } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    channel.send('DEACTIVATE_TOOL', { rowId: 'row-1' });
    viewerWindow.postMessage.mockClear();

    channel.dispose();

    expect(viewerWindow.postMessage).not.toHaveBeenCalled();
  });

  it('sends at most one DEACTIVATE_TOOL when dispose is called twice while armed', () => {
    const { channel, viewerWindow } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    viewerWindow.postMessage.mockClear();

    channel.dispose();
    channel.dispose();

    expect(viewerWindow.postMessage).toHaveBeenCalledTimes(1);
  });

  it('does not throw on dispose when the viewer window has disappeared', () => {
    let viewerWindowAvailable = true;
    const viewerWindow = { postMessage: vi.fn() };
    const channel = createHostChannel({
      viewerOrigin: VIEWER_ORIGIN,
      getViewerWindow: () => (viewerWindowAvailable ? (viewerWindow as unknown as Window) : null),
    });
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });
    viewerWindowAvailable = false;
    viewerWindow.postMessage.mockClear();

    expect(() => {
      channel.dispose();
    }).not.toThrow();
    expect(viewerWindow.postMessage).not.toHaveBeenCalled();
  });
});
