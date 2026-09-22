import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActivateToolCommand, MeasurementRemovedEvent } from '@bdiadiun/scoring-contract';
import { EXCHANGE_TIMEOUT_MS } from '../../host/pendingAnswers';
import { LOG_PREFIX } from '../peer';
import type { WireMessage } from './fixtures';
import {
  activateToolMessage,
  createHostChannelFixture,
  createViewerChannelFixture,
  disposeAllFixtureChannels,
  dispatchMessage,
  HOST_ORIGIN,
  measurementAddedMessage,
  measurementRemovedMessage,
  VIEWER_ORIGIN,
  viewerReadyMessage,
} from './fixtures';

afterEach(() => {
  disposeAllFixtureChannels();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('origin (Q-2)', () => {
  it('reaches no handler for a message from any origin other than the configured peer, on the host end', () => {
    const { channel } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage(viewerReadyMessage(), 'http://evil.example');

    expect(onReady).not.toHaveBeenCalled();
  });

  it('reaches the handler for a message from the configured peer origin, on the host end', () => {
    const { channel } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('does not settle a pending exchange with a message from a foreign origin', async () => {
    const { channel, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = (posted()[0] as { requestId: string }).requestId;
    answer.catch(() => undefined);

    dispatchMessage(
      measurementRemovedMessage('uid-1', { causedBy: requestId }),
      'http://evil.example',
    );
    dispatchMessage(measurementRemovedMessage('uid-1', { causedBy: requestId }), VIEWER_ORIGIN);

    await expect(answer).resolves.toMatchObject({ causedBy: requestId });
  });

  it('ignores a message from any origin other than the configured peer, on the viewer end', () => {
    const { channel } = createViewerChannelFixture();
    const onActivate = vi.fn();
    channel.on('ACTIVATE_TOOL', onActivate);

    dispatchMessage(activateToolMessage('row-1'), 'http://evil.example');

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('reaches the handler for a message from the configured peer origin, on the viewer end', () => {
    const { channel } = createViewerChannelFixture();
    const onActivate = vi.fn();
    channel.on('ACTIVATE_TOOL', onActivate);

    dispatchMessage(activateToolMessage('row-1'), HOST_ORIGIN);

    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});

describe('the contract guard', () => {
  it('ignores a payload the guard rejects from the correct origin, on the host end', () => {
    const { channel } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage({ version: 1, type: 'NOT_A_REAL_EVENT' }, VIEWER_ORIGIN);

    expect(onReady).not.toHaveBeenCalled();
  });

  it('ignores a payload the guard rejects from the correct origin, on the viewer end', () => {
    const { channel } = createViewerChannelFixture();
    const onActivate = vi.fn();
    channel.on('ACTIVATE_TOOL', onActivate);

    dispatchMessage({ version: 1, type: 'ACTIVATE_TOOL' }, HOST_ORIGIN);

    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('the contract version on the wire (A-25)', () => {
  const collectDebugLines = (): string[] => {
    const lines: string[] = [];
    vi.spyOn(console, 'debug').mockImplementation((line: string) => {
      lines.push(line);
    });
    return lines;
  };

  const ignoredVersionLine = (version: string): string =>
    `${LOG_PREFIX} ignoring message of contract version ${version}`;

  it('stamps version 1 on a host command it posts', () => {
    const { channel, viewerWindow } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });

    const [posted] = viewerWindow.postMessage.mock.calls[0] as [{ version: number }, string];
    expect(posted.version).toBe(1);
  });

  it('stamps version 1 on a viewer event it posts', () => {
    const { channel, hostWindow } = createViewerChannelFixture();

    channel.send('MEASUREMENT_REMOVED', { measurementUid: 'uid-1' });

    const [posted] = hostWindow.postMessage.mock.calls[0] as [{ version: number }, string];
    expect(posted.version).toBe(1);
  });

  it('reaches no handler with a message of another contract version', () => {
    const { channel } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage({ ...viewerReadyMessage(), version: 2 }, VIEWER_ORIGIN);

    expect(onReady).not.toHaveBeenCalled();
  });

  it('settles no exchange with an answer of another contract version', async () => {
    const { channel, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = (posted()[0] as { requestId: string }).requestId;

    dispatchMessage(
      { ...measurementRemovedMessage('uid-2', { causedBy: requestId }), version: 2 },
      VIEWER_ORIGIN,
    );
    dispatchMessage(measurementRemovedMessage('uid-1', { causedBy: requestId }), VIEWER_ORIGIN);

    await expect(answer).resolves.toMatchObject({ measurementUid: 'uid-1' });
  });

  it('logs an unknown contract version once however many messages carry it', () => {
    const debugLines = collectDebugLines();
    const { channel } = createHostChannelFixture();
    channel.on('VIEWER_READY', vi.fn());

    dispatchMessage({ ...viewerReadyMessage(), version: 2 }, VIEWER_ORIGIN);
    dispatchMessage({ ...viewerReadyMessage(), version: 2 }, VIEWER_ORIGIN);

    expect(debugLines.filter((line) => line === ignoredVersionLine('2'))).toHaveLength(1);
  });

  it('reaches no handler with a message carrying no contract version at all', () => {
    const debugLines = collectDebugLines();
    const { channel } = createHostChannelFixture();
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    dispatchMessage({ type: 'VIEWER_READY', viewerVersion: '1.0.0' }, VIEWER_ORIGIN);

    expect(onReady).not.toHaveBeenCalled();
    expect(debugLines.filter((line) => line === ignoredVersionLine('undefined'))).toHaveLength(1);
  });
});

describe('send', () => {
  it('stamps a request id the caller never wrote onto an outgoing host command, posted to the exact peer origin', () => {
    const { channel, viewerWindow, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    const delivered = channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });

    expect(delivered).toBe(true);
    const messages = posted();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: 'ACTIVATE_TOOL', rowId: 'row-1' });
    const requestId = (messages[0] as ActivateToolCommand).requestId;
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
    const [, targetOrigin] = viewerWindow.postMessage.mock.calls[0] as [unknown, string];
    expect(targetOrigin).toBe(VIEWER_ORIGIN);
    expect(targetOrigin).not.toBe('*');
  });

  it('stamps no request id onto an outgoing viewer event, which is one-way, posted to the exact peer origin', () => {
    const { channel, hostWindow, posted } = createViewerChannelFixture();

    channel.send('MEASUREMENT_REMOVED', { measurementUid: 'uid-1' });

    const messages = posted();
    expect(messages).toEqual<[WireMessage<MeasurementRemovedEvent>]>([
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1' },
    ]);
    const [, targetOrigin] = hostWindow.postMessage.mock.calls[0] as [unknown, string];
    expect(targetOrigin).toBe(HOST_ORIGIN);
    expect(targetOrigin).not.toBe('*');
  });

  it('reaches only the handler registered for that type', () => {
    const { channel } = createHostChannelFixture();
    const onAdded = vi.fn();
    const onUpdated = vi.fn();
    channel.on('MEASUREMENT_ADDED', onAdded);
    channel.on('MEASUREMENT_UPDATED', onUpdated);

    dispatchMessage(measurementAddedMessage('row-1'), VIEWER_ORIGIN);

    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
  });
});

describe('onEach', () => {
  it('registers one handler per type, and its single unsubscribe removes all of them', () => {
    const { channel } = createHostChannelFixture();
    const onReady = vi.fn();
    const onAdded = vi.fn();
    const unsubscribe = channel.onEach({ VIEWER_READY: onReady, MEASUREMENT_ADDED: onAdded });

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    dispatchMessage(measurementAddedMessage('row-1'), VIEWER_ORIGIN);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onAdded).toHaveBeenCalledTimes(1);

    unsubscribe();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    dispatchMessage(measurementAddedMessage('row-1'), VIEWER_ORIGIN);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onAdded).toHaveBeenCalledTimes(1);
  });
});

describe('exchange', () => {
  it('resolves with the answer that carries its request id', () => {
    const { channel, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = (posted()[0] as { requestId: string }).requestId;

    dispatchMessage(measurementRemovedMessage('uid-1', { causedBy: requestId }), VIEWER_ORIGIN);

    return expect(answer).resolves.toMatchObject({ causedBy: requestId });
  });

  it('is not confused by an answer carrying somebody else’s request id', async () => {
    const { channel, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    const onRemoved = vi.fn();
    channel.on('MEASUREMENT_REMOVED', onRemoved);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = (posted()[0] as { requestId: string }).requestId;

    dispatchMessage(
      measurementRemovedMessage('uid-9', { causedBy: 'somebody-elses-request' }),
      VIEWER_ORIGIN,
    );
    // A message answering nobody's exchange falls through to the general handlers instead.
    expect(onRemoved).toHaveBeenCalledTimes(1);

    dispatchMessage(measurementRemovedMessage('uid-1', { causedBy: requestId }), VIEWER_ORIGIN);

    await expect(answer).resolves.toMatchObject({ causedBy: requestId });
  });

  it('rejects, naming the request and the answer it waited for, when nothing answers before the timeout', async () => {
    vi.useFakeTimers();
    const { channel, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = (posted()[0] as { requestId: string }).requestId;

    vi.advanceTimersByTime(EXCHANGE_TIMEOUT_MS);

    await expect(answer).rejects.toThrow(
      `REMOVE_MEASUREMENT ${requestId} was not answered with MEASUREMENT_REMOVED within ${String(EXCHANGE_TIMEOUT_MS)} ms`,
    );
  });

  it('leaves nothing behind once settled: a later message with the same causedBy reaches the general handlers', async () => {
    const { channel, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    const onRemoved = vi.fn();
    channel.on('MEASUREMENT_REMOVED', onRemoved);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = (posted()[0] as { requestId: string }).requestId;
    dispatchMessage(measurementRemovedMessage('uid-1', { causedBy: requestId }), VIEWER_ORIGIN);
    await answer;

    dispatchMessage(measurementRemovedMessage('uid-1', { causedBy: requestId }), VIEWER_ORIGIN);

    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing behind once timed out: a later message with the same causedBy reaches the general handlers', async () => {
    vi.useFakeTimers();
    const { channel, posted } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    const onRemoved = vi.fn();
    channel.on('MEASUREMENT_REMOVED', onRemoved);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });
    const requestId = (posted()[0] as { requestId: string }).requestId;
    answer.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(EXCHANGE_TIMEOUT_MS);

    dispatchMessage(measurementRemovedMessage('uid-1', { causedBy: requestId }), VIEWER_ORIGIN);

    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it('dispose rejects what is still waiting and removes the message listener', async () => {
    const { channel } = createHostChannelFixture();
    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const onReady = vi.fn();
    channel.on('VIEWER_READY', onReady);

    const answer = channel.exchange('REMOVE_MEASUREMENT', {
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });

    channel.dispose();

    await expect(answer).rejects.toThrow('the channel was disposed before the answer arrived');
    expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    expect(onReady).not.toHaveBeenCalled();
  });
});

describe('the viewer channel, which holds nothing back', () => {
  it('is not ready before it has announced itself', () => {
    const { channel } = createViewerChannelFixture();

    expect(channel.getState()).toEqual({ ready: false, queued: 0 });
  });

  it('becomes ready once its announcement has been delivered', () => {
    const { channel } = createViewerChannelFixture();

    channel.send('VIEWER_READY', { viewerVersion: '1.0.0' });

    expect(channel.getState()).toEqual({ ready: true, queued: 0 });
  });

  it('posts an event before the announcement rather than queuing it', () => {
    const { channel, hostWindow } = createViewerChannelFixture();

    const delivered = channel.send('MEASUREMENT_REMOVED', { measurementUid: 'uid-1' });

    expect(delivered).toBe(true);
    expect(hostWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(channel.getState().queued).toBe(0);
  });

  it('drops, without queuing, what it cannot deliver when the page is not framed', () => {
    const { channel, hostWindow } = createViewerChannelFixture({ framed: false });

    const delivered = channel.send('VIEWER_READY', { viewerVersion: '1.0.0' });

    expect(delivered).toBe(false);
    expect(hostWindow.postMessage).not.toHaveBeenCalled();
    expect(channel.getState()).toEqual({ ready: false, queued: 0 });
  });
});

describe('what the channel writes to the console', () => {
  it('logs every message it sends and every message it receives at debug level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const { channel } = createHostChannelFixture();

    dispatchMessage(viewerReadyMessage(), VIEWER_ORIGIN);
    channel.send('ACTIVATE_TOOL', { rowId: 'row-1', toolName: 'EllipticalROI' });

    expect(debugSpy).toHaveBeenCalledWith(
      `${LOG_PREFIX} received VIEWER_READY`,
      expect.objectContaining({ type: 'VIEWER_READY' }),
    );
    expect(debugSpy).toHaveBeenCalledWith(
      `${LOG_PREFIX} sent ACTIVATE_TOOL`,
      expect.objectContaining({ type: 'ACTIVATE_TOOL' }),
    );
  });
});
