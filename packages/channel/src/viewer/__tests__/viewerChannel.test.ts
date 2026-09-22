// The viewer end's own behaviour on top of the generic channel (A-23): announcing the viewer,
// the row the host armed, and the answer a command is entitled to. Origin, the contract guard and
// the queue are exercised in channel.test.ts and not repeated here.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  MeasurementAddedEvent,
  RemoveMeasurementCommand,
  RestoreMeasurementsCommand,
} from '@bdiadiun/scoring-contract';
import { createViewerChannel } from '../viewerChannel';
import {
  activateToolMessage,
  createFakePeerWindow,
  createViewerChannelFixture,
  deactivateToolMessage,
  disposeAllFixtureChannels,
  dispatchMessage,
  HOST_ORIGIN,
} from '../../shared/__tests__/fixtures';

const removeCommand = (requestId = 'req-remove'): RemoveMeasurementCommand => ({
  type: 'REMOVE_MEASUREMENT',
  requestId,
  rowId: 'row-1',
  measurementUid: 'uid-1',
});

const restoreCommand = (requestId = 'req-restore'): RestoreMeasurementsCommand => ({
  type: 'RESTORE_MEASUREMENTS',
  requestId,
  studyInstanceUid: 'study-1',
  measurements: [],
});

type MeasurementAddedPayload = Omit<MeasurementAddedEvent, 'type'>;

const measurementAddedPayload = (rowId: string | null): MeasurementAddedPayload => ({
  rowId,
  measurementUid: 'uid-1',
  toolName: 'EllipticalROI',
  metrics: { area: { value: 12.5, unit: 'mm2' } },
});

afterEach(() => {
  disposeAllFixtureChannels();
  vi.restoreAllMocks();
});

describe('announcing the viewer (Q-1)', () => {
  it('posts VIEWER_READY once and reports it was delivered', () => {
    const { channel, posted } = createViewerChannelFixture();

    const announced = channel.announceReady({ viewerVersion: '3.12.17' });

    expect(announced).toBe(true);
    expect(posted()).toEqual([{ version: 1, type: 'VIEWER_READY', viewerVersion: '3.12.17' }]);
  });

  it('posts nothing more when it is told to announce again', () => {
    const { channel, hostWindow } = createViewerChannelFixture();
    channel.announceReady({ viewerVersion: '3.12.17' });

    const announcedAgain = channel.announceReady({ viewerVersion: '3.12.17' });

    expect(announcedAgain).toBe(true);
    expect(hostWindow.postMessage).toHaveBeenCalledTimes(1);
  });

  it('stays unannounced and reports failure when the viewer is not framed', () => {
    const { channel, hostWindow } = createViewerChannelFixture({ framed: false });

    const announced = channel.announceReady({ viewerVersion: '3.12.17' });

    expect(announced).toBe(false);
    expect(hostWindow.postMessage).not.toHaveBeenCalled();
    expect(channel.getState().ready).toBe(false);
  });

  it('announces on a later attempt when the first one found no host window', () => {
    const hostWindow = createFakePeerWindow();
    let framed = false;
    vi.spyOn(window, 'parent', 'get').mockImplementation(
      () => (framed ? hostWindow : window) as unknown as Window,
    );
    const channel = createViewerChannel({ hostOrigin: HOST_ORIGIN });
    channel.announceReady({ viewerVersion: '3.12.17' });

    framed = true;
    const announced = channel.announceReady({ viewerVersion: '3.12.17' });

    expect(announced).toBe(true);
    expect(hostWindow.postMessage).toHaveBeenCalledTimes(1);
    channel.dispose();
  });
});

describe('state and subscription (Q-1)', () => {
  it('reports not ready with nothing queued before the viewer announces itself', () => {
    const { channel } = createViewerChannelFixture();

    expect(channel.getState()).toEqual({ ready: false, queued: 0 });
  });

  it('reports ready with nothing queued once announceReady has delivered VIEWER_READY', () => {
    const { channel } = createViewerChannelFixture();

    channel.announceReady({ viewerVersion: '3.12.17' });

    expect(channel.getState()).toEqual({ ready: true, queued: 0 });
  });

  it('notifies a subscriber when announceReady delivers VIEWER_READY', () => {
    const { channel } = createViewerChannelFixture();
    const listener = vi.fn();
    channel.subscribe(listener);

    channel.announceReady({ viewerVersion: '3.12.17' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a subscriber once it has unsubscribed', () => {
    const { channel } = createViewerChannelFixture();
    const listener = vi.fn();
    const unsubscribe = channel.subscribe(listener);
    unsubscribe();

    channel.announceReady({ viewerVersion: '3.12.17' });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the row the host armed (A-8)', () => {
  it('is armed by ACTIVATE_TOOL before the application handlers run', () => {
    const { channel } = createViewerChannelFixture();
    const seen: unknown[] = [];
    channel.on('ACTIVATE_TOOL', () => seen.push(channel.getArmed()));

    dispatchMessage(activateToolMessage('row-1', 'req-1'), HOST_ORIGIN);

    expect(seen).toEqual([{ rowId: 'row-1', requestId: 'req-1' }]);
  });

  it('is nothing before any command arrives', () => {
    const { channel } = createViewerChannelFixture();

    expect(channel.getArmed()).toBeNull();
  });

  it('is cleared by DEACTIVATE_TOOL of the armed row', () => {
    const { channel } = createViewerChannelFixture();
    dispatchMessage(activateToolMessage('row-1', 'req-1'), HOST_ORIGIN);

    dispatchMessage(deactivateToolMessage('row-1'), HOST_ORIGIN);

    expect(channel.getArmed()).toBeNull();
  });

  it('survives DEACTIVATE_TOOL of a different row', () => {
    const { channel } = createViewerChannelFixture();
    dispatchMessage(activateToolMessage('row-1', 'req-1'), HOST_ORIGIN);

    dispatchMessage(deactivateToolMessage('row-2'), HOST_ORIGIN);

    expect(channel.getArmed()).toEqual({ rowId: 'row-1', requestId: 'req-1' });
  });

  it('is cleared once MEASUREMENT_ADDED for that row has been sent', () => {
    const { channel } = createViewerChannelFixture();
    dispatchMessage(activateToolMessage('row-1', 'req-1'), HOST_ORIGIN);

    channel.send('MEASUREMENT_ADDED', measurementAddedPayload('row-1'));

    expect(channel.getArmed()).toBeNull();
  });

  it('survives MEASUREMENT_ADDED carrying a different row', () => {
    const { channel } = createViewerChannelFixture();
    dispatchMessage(activateToolMessage('row-1', 'req-1'), HOST_ORIGIN);

    channel.send('MEASUREMENT_ADDED', measurementAddedPayload('row-2'));

    expect(channel.getArmed()).toEqual({ rowId: 'row-1', requestId: 'req-1' });
  });

  it('stays armed when the MEASUREMENT_ADDED could not be delivered', () => {
    const { channel } = createViewerChannelFixture({ framed: false });
    dispatchMessage(activateToolMessage('row-1', 'req-1'), HOST_ORIGIN);

    const delivered = channel.send('MEASUREMENT_ADDED', measurementAddedPayload('row-1'));

    expect(delivered).toBe(false);
    expect(channel.getArmed()).toEqual({ rowId: 'row-1', requestId: 'req-1' });
  });

  it('is forgotten on dispose', () => {
    const { channel } = createViewerChannelFixture();
    dispatchMessage(activateToolMessage('row-1', 'req-1'), HOST_ORIGIN);

    channel.dispose();

    expect(channel.getArmed()).toBeNull();
  });
});

describe('the answer a command is entitled to (A-10)', () => {
  it('answers REMOVE_MEASUREMENT with MEASUREMENT_REMOVED caused by that command', () => {
    const { channel, posted } = createViewerChannelFixture();

    const delivered = channel.reply(removeCommand('req-remove'), { measurementUid: 'uid-1' });

    expect(delivered).toBe(true);
    expect(posted()).toEqual([
      {
        version: 1,
        type: 'MEASUREMENT_REMOVED',
        measurementUid: 'uid-1',
        causedBy: 'req-remove',
      },
    ]);
  });

  it('answers RESTORE_MEASUREMENTS with MEASUREMENTS_RESTORED caused by that command', () => {
    const { channel, posted } = createViewerChannelFixture();

    channel.reply(restoreCommand('req-restore'), { restored: ['row-1'], failed: [] });

    expect(posted()).toEqual([
      {
        version: 1,
        type: 'MEASUREMENTS_RESTORED',
        restored: ['row-1'],
        failed: [],
        causedBy: 'req-restore',
      },
    ]);
  });
});
