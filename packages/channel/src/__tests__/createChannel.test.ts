import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createHostChannelFixture,
  createViewerChannelFixture,
  dispatchMessage,
  HOST_ORIGIN,
  VIEWER_ORIGIN,
} from './fixtures';

afterEach(() => {
  vi.useRealTimers();
});

describe('origin (Q-2)', () => {
  it('reaches no handler for a message from any origin other than the configured peer, on the host end', () => {
    const { channel, localWindow } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage(
      localWindow,
      { version: 1, type: 'VIEWER_READY', viewerVersion: '1.0.0' },
      'http://evil.example',
    );

    expect(onReady).not.toHaveBeenCalled();
  });

  it('reaches the handler for a message from the configured peer origin, on the host end', () => {
    const { channel, localWindow } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage(
      localWindow,
      { version: 1, type: 'VIEWER_READY', viewerVersion: '1.0.0' },
      VIEWER_ORIGIN,
    );

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('does not settle a pending exchange with a message from a foreign origin', async () => {
    const { channel, localWindow, delivered } = createHostChannelFixture({
      exchangeTimeoutMs: 1000,
    });
    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = delivered[0].requestId;
    answer.catch(() => undefined);

    dispatchMessage(
      localWindow,
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: requestId },
      'http://evil.example',
    );
    dispatchMessage(
      localWindow,
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: requestId },
      VIEWER_ORIGIN,
    );

    await expect(answer).resolves.toMatchObject({ causedBy: requestId });
  });

  it('ignores a message from any origin other than the configured peer, on the viewer end', () => {
    const { channel, localWindow } = createViewerChannelFixture();
    const onActivate = vi.fn();
    channel.on('ACTIVATE_TOOL', onActivate);

    dispatchMessage(
      localWindow,
      { version: 1, type: 'ACTIVATE_TOOL', requestId: 'req-1', rowId: 'row-1', toolName: 'Length' },
      'http://evil.example',
    );

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('reaches the handler for a message from the configured peer origin, on the viewer end', () => {
    const { channel, localWindow } = createViewerChannelFixture();
    const onActivate = vi.fn();
    channel.on('ACTIVATE_TOOL', onActivate);

    dispatchMessage(
      localWindow,
      { version: 1, type: 'ACTIVATE_TOOL', requestId: 'req-1', rowId: 'row-1', toolName: 'Length' },
      HOST_ORIGIN,
    );

    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});

describe('the contract guard', () => {
  it('ignores a payload the guard rejects from the correct origin, on the host end', () => {
    const { channel, localWindow } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage(localWindow, { version: 1, type: 'NOT_A_REAL_EVENT' }, VIEWER_ORIGIN);

    expect(onReady).not.toHaveBeenCalled();
  });

  it('ignores a payload the guard rejects from the correct origin, on the viewer end', () => {
    const { channel, localWindow } = createViewerChannelFixture();
    const onActivate = vi.fn();
    channel.on('ACTIVATE_TOOL', onActivate);

    dispatchMessage(localWindow, { version: 1, type: 'ACTIVATE_TOOL' }, HOST_ORIGIN);

    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('send', () => {
  it('stamps version 1 and a request id the caller never wrote onto an outgoing host command', () => {
    const { channel, delivered } = createHostChannelFixture();

    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ version: 1, type: 'ACTIVATE_TOOL', rowId: 'row-1' });
    expect(typeof delivered[0].requestId).toBe('string');
    expect(delivered[0].requestId.length).toBeGreaterThan(0);
  });

  it('stamps version 1 but no request id onto an outgoing viewer event, which is one-way', () => {
    const { channel, delivered } = createViewerChannelFixture();

    channel.send('MEASUREMENT_REMOVED', { measurementUid: 'uid-1' });

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toEqual({
      version: 1,
      type: 'MEASUREMENT_REMOVED',
      measurementUid: 'uid-1',
    });
  });

  it('reaches only the handler registered for that type', () => {
    const { channel, localWindow } = createHostChannelFixture();
    const onAdded = vi.fn();
    const onUpdated = vi.fn();
    channel.on('MEASUREMENT_ADDED', onAdded);
    channel.on('MEASUREMENT_UPDATED', onUpdated);

    dispatchMessage(
      localWindow,
      {
        version: 1,
        type: 'MEASUREMENT_ADDED',
        rowId: 'row-1',
        measurementUid: 'uid-1',
        toolName: 'EllipticalROI',
        metrics: {},
      },
      VIEWER_ORIGIN,
    );

    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
  });
});

describe('exchange', () => {
  it('resolves with the answer that carries its request id', () => {
    const { channel, delivered, localWindow } = createHostChannelFixture();

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = delivered[0].requestId;

    dispatchMessage(
      localWindow,
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: requestId },
      VIEWER_ORIGIN,
    );

    return expect(answer).resolves.toMatchObject({ causedBy: requestId });
  });

  it('is not confused by an answer carrying somebody else’s request id', async () => {
    const { channel, delivered, localWindow } = createHostChannelFixture();
    const onRemoved = vi.fn();
    channel.on('MEASUREMENT_REMOVED', onRemoved);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = delivered[0].requestId;

    dispatchMessage(
      localWindow,
      {
        version: 1,
        type: 'MEASUREMENT_REMOVED',
        measurementUid: 'uid-9',
        causedBy: 'somebody-elses-request',
      },
      VIEWER_ORIGIN,
    );
    // A message answering nobody's exchange falls through to the general handlers instead.
    expect(onRemoved).toHaveBeenCalledTimes(1);

    dispatchMessage(
      localWindow,
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: requestId },
      VIEWER_ORIGIN,
    );

    await expect(answer).resolves.toMatchObject({ causedBy: requestId });
  });

  it('rejects, naming the request and the answer it waited for, when nothing answers before the timeout', async () => {
    vi.useFakeTimers();
    const { channel, delivered } = createHostChannelFixture({ exchangeTimeoutMs: 1000 });

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = delivered[0].requestId;

    vi.advanceTimersByTime(1000);

    await expect(answer).rejects.toThrow(
      `REMOVE_MEASUREMENT ${requestId} was not answered with MEASUREMENT_REMOVED within 1000 ms`,
    );
  });

  it('leaves nothing behind once settled: a later message with the same causedBy reaches the general handlers', async () => {
    const { channel, delivered, localWindow } = createHostChannelFixture();
    const onRemoved = vi.fn();
    channel.on('MEASUREMENT_REMOVED', onRemoved);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = delivered[0].requestId;
    dispatchMessage(
      localWindow,
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: requestId },
      VIEWER_ORIGIN,
    );
    await answer;

    dispatchMessage(
      localWindow,
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: requestId },
      VIEWER_ORIGIN,
    );

    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing behind once timed out: a later message with the same causedBy reaches the general handlers', async () => {
    vi.useFakeTimers();
    const { channel, delivered, localWindow } = createHostChannelFixture({
      exchangeTimeoutMs: 1000,
    });
    const onRemoved = vi.fn();
    channel.on('MEASUREMENT_REMOVED', onRemoved);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = delivered[0].requestId;
    answer.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1000);

    dispatchMessage(
      localWindow,
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: requestId },
      VIEWER_ORIGIN,
    );

    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it('dispose rejects what is still waiting and removes the message listener', async () => {
    const { channel, localWindow } = createHostChannelFixture();
    const removeSpy = vi.spyOn(localWindow, 'removeEventListener');
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });

    channel.dispose();

    await expect(answer).rejects.toThrow('the channel was disposed before the answer arrived');
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));

    dispatchMessage(
      localWindow,
      { version: 1, type: 'VIEWER_READY', viewerVersion: '1.0.0' },
      VIEWER_ORIGIN,
    );
    expect(onReady).not.toHaveBeenCalled();
  });
});
