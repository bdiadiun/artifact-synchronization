// Unit tests for the framework-free bridge client (canon Q-1, Q-2, Q-5, P-1, P-9; decision A-9).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActivateToolCommand,
  DeactivateToolCommand,
  ViewerReadyEvent,
} from '@scoring/contract';
import { createBridge, type Bridge } from './createBridge';

const VIEWER_ORIGIN = 'http://localhost:3000';
const FOREIGN_ORIGIN = 'http://localhost:5173';

const activate: ActivateToolCommand = {
  version: 1,
  type: 'ACTIVATE_TOOL',
  requestId: 'req-1',
  rowId: 'row-1',
  toolName: 'EllipticalROI',
};

const deactivate: DeactivateToolCommand = {
  version: 1,
  type: 'DEACTIVATE_TOOL',
  requestId: 'req-2',
  rowId: 'row-1',
};

const viewerReady: ViewerReadyEvent = {
  version: 1,
  type: 'VIEWER_READY',
  viewerVersion: 'test',
};

// Dispatches a fake incoming viewer message on `window`, as the real iframe would via
// `window.postMessage` from the child frame.
const dispatchFromViewer = (data: unknown, origin = VIEWER_ORIGIN): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

describe('createBridge', () => {
  let fakeViewerWindow: { postMessage: ReturnType<typeof vi.fn> };
  let bridge: Bridge;

  beforeEach(() => {
    fakeViewerWindow = { postMessage: vi.fn() };
    bridge = createBridge({
      getViewerWindow: () => fakeViewerWindow as unknown as Window,
      viewerOrigin: VIEWER_ORIGIN,
    });
  });

  afterEach(() => {
    bridge.dispose();
  });

  it('ignores messages from a foreign origin and counts them', () => {
    dispatchFromViewer(viewerReady, FOREIGN_ORIGIN);

    expect(bridge.getState().ready).toBe(false);
    expect(bridge.getState().ignoredOrigins).toBe(1);
  });

  it('ignores a malformed payload from the correct origin', () => {
    dispatchFromViewer({ version: 1, type: 'NOT_A_REAL_TYPE' });

    expect(bridge.getState().ready).toBe(false);
    expect(bridge.getState().lastEvent).toBeNull();
  });

  it('queues a command sent before READY instead of posting it', () => {
    bridge.send(activate);

    expect(fakeViewerWindow.postMessage).not.toHaveBeenCalled();
    expect(bridge.getState().queued).toBe(1);
  });

  it('flushes the queue in FIFO order on READY with the exact targetOrigin', () => {
    bridge.send(activate);
    bridge.send(deactivate);

    dispatchFromViewer(viewerReady);

    expect(fakeViewerWindow.postMessage).toHaveBeenCalledTimes(2);
    expect(fakeViewerWindow.postMessage).toHaveBeenNthCalledWith(1, activate, VIEWER_ORIGIN);
    expect(fakeViewerWindow.postMessage).toHaveBeenNthCalledWith(2, deactivate, VIEWER_ORIGIN);
    expect(bridge.getState().ready).toBe(true);
    expect(bridge.getState().queued).toBe(0);
  });

  it('sends commands immediately once ready, without queuing', () => {
    dispatchFromViewer(viewerReady);

    bridge.send(activate);

    expect(fakeViewerWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(fakeViewerWindow.postMessage).toHaveBeenCalledWith(activate, VIEWER_ORIGIN);
    expect(bridge.getState().queued).toBe(0);
  });

  it('re-emits the event and stays functional on a second READY (viewer reload)', () => {
    const events: unknown[] = [];
    bridge.subscribe((event) => events.push(event));

    dispatchFromViewer(viewerReady);
    dispatchFromViewer(viewerReady);

    expect(bridge.getState().ready).toBe(true);
    // First READY: one notify. Second READY: ready flips false then true, so two more notifies.
    const readyEvents = events.filter(
      (event) => (event as ViewerReadyEvent | null)?.type === 'VIEWER_READY',
    );
    expect(readyEvents.length).toBe(3);

    bridge.send(activate);
    expect(fakeViewerWindow.postMessage).toHaveBeenCalledWith(activate, VIEWER_ORIGIN);
  });

  it('dispose removes the listener so a later message is a no-op', () => {
    dispatchFromViewer(viewerReady);
    const stateAfterReady = bridge.getState();
    bridge.dispose();

    dispatchFromViewer({
      version: 1,
      type: 'MEASUREMENT_UPDATED',
      measurementUid: 'm-1',
      toolName: 'EllipticalROI',
      metrics: {},
    });

    // The listener is gone, so the post-dispose message never reaches the handler: `lastEvent`
    // stays exactly what it was right after READY instead of picking up MEASUREMENT_UPDATED.
    expect(bridge.getState().lastEvent).toBe(stateAfterReady.lastEvent);
    expect(bridge.getState().ready).toBe(false);
  });

  it('dispose is idempotent', () => {
    expect(() => {
      bridge.dispose();
      bridge.dispose();
    }).not.toThrow();
  });

  it('subscribe returns an unsubscribe function that stops further notifications', () => {
    const listener = vi.fn();
    const unsubscribe = bridge.subscribe(listener);

    dispatchFromViewer(viewerReady);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();

    bridge.send(activate);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not send with targetOrigin "*"', () => {
    dispatchFromViewer(viewerReady);
    bridge.send(activate);

    for (const call of fakeViewerWindow.postMessage.mock.calls) {
      expect(call[1]).toBe(VIEWER_ORIGIN);
      expect(call[1]).not.toBe('*');
    }
  });
});
