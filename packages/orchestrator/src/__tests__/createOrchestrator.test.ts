import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActivateToolCommand,
  DeactivateToolCommand,
  ViewerReadyEvent,
} from '@bdiadiun/scoring-contract';
import { createOrchestrator, type Orchestrator } from '../createOrchestrator';

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

describe('createOrchestrator', () => {
  let fakeViewerWindow: { postMessage: ReturnType<typeof vi.fn> };
  let orchestrator: Orchestrator;

  beforeEach(() => {
    fakeViewerWindow = { postMessage: vi.fn() };
    orchestrator = createOrchestrator({
      getViewerWindow: () => fakeViewerWindow as unknown as Window,
      viewerOrigin: VIEWER_ORIGIN,
    });
  });

  afterEach(() => {
    orchestrator.dispose();
  });

  it('ignores messages from a foreign origin and counts them', () => {
    dispatchFromViewer(viewerReady, FOREIGN_ORIGIN);

    expect(orchestrator.getState().ready).toBe(false);
    expect(orchestrator.getState().ignoredOrigins).toBe(1);
  });

  it('ignores a malformed payload from the correct origin', () => {
    dispatchFromViewer({ version: 1, type: 'NOT_A_REAL_TYPE' });

    expect(orchestrator.getState().ready).toBe(false);
    expect(orchestrator.getState().lastEvent).toBeNull();
  });

  it('queues a command sent before READY instead of posting it', () => {
    orchestrator.send(activate);

    expect(fakeViewerWindow.postMessage).not.toHaveBeenCalled();
    expect(orchestrator.getState().queued).toBe(1);
  });

  it('flushes the queue in FIFO order on READY with the exact targetOrigin', () => {
    orchestrator.send(activate);
    orchestrator.send(deactivate);

    dispatchFromViewer(viewerReady);

    expect(fakeViewerWindow.postMessage).toHaveBeenCalledTimes(2);
    expect(fakeViewerWindow.postMessage).toHaveBeenNthCalledWith(1, activate, VIEWER_ORIGIN);
    expect(fakeViewerWindow.postMessage).toHaveBeenNthCalledWith(2, deactivate, VIEWER_ORIGIN);
    expect(orchestrator.getState().ready).toBe(true);
    expect(orchestrator.getState().queued).toBe(0);
  });

  it('sends commands immediately once ready, without queuing', () => {
    dispatchFromViewer(viewerReady);

    orchestrator.send(activate);

    expect(fakeViewerWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(fakeViewerWindow.postMessage).toHaveBeenCalledWith(activate, VIEWER_ORIGIN);
    expect(orchestrator.getState().queued).toBe(0);
  });

  it('re-emits the event and stays functional on a second READY (viewer reload)', () => {
    const events: unknown[] = [];
    orchestrator.subscribe((event) => events.push(event));

    dispatchFromViewer(viewerReady);
    dispatchFromViewer(viewerReady);

    expect(orchestrator.getState().ready).toBe(true);
    // First READY: one notify. Second READY: ready flips false then true, so two more notifies.
    const readyEvents = events.filter(
      (event) => (event as ViewerReadyEvent | null)?.type === 'VIEWER_READY',
    );
    expect(readyEvents.length).toBe(3);

    orchestrator.send(activate);
    expect(fakeViewerWindow.postMessage).toHaveBeenCalledWith(activate, VIEWER_ORIGIN);
  });

  it('dispose removes the listener so a later message is a no-op', () => {
    dispatchFromViewer(viewerReady);
    const stateAfterReady = orchestrator.getState();
    orchestrator.dispose();

    dispatchFromViewer({
      version: 1,
      type: 'MEASUREMENT_UPDATED',
      measurementUid: 'm-1',
      toolName: 'EllipticalROI',
      metrics: {},
    });

    // The listener is gone, so the post-dispose message never reaches the handler: `lastEvent`
    // stays exactly what it was right after READY instead of picking up MEASUREMENT_UPDATED.
    expect(orchestrator.getState().lastEvent).toBe(stateAfterReady.lastEvent);
    expect(orchestrator.getState().ready).toBe(false);
  });

  it('dispose is idempotent', () => {
    expect(() => {
      orchestrator.dispose();
      orchestrator.dispose();
    }).not.toThrow();
  });

  it('subscribe returns an unsubscribe function that stops further notifications', () => {
    const listener = vi.fn();
    const unsubscribe = orchestrator.subscribe(listener);

    dispatchFromViewer(viewerReady);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();

    orchestrator.send(activate);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not send with targetOrigin "*"', () => {
    dispatchFromViewer(viewerReady);
    orchestrator.send(activate);

    for (const call of fakeViewerWindow.postMessage.mock.calls) {
      expect(call[1]).toBe(VIEWER_ORIGIN);
      expect(call[1]).not.toBe('*');
    }
  });

  it('disarms on dispose: posts one DEACTIVATE_TOOL with an explicit target origin when armed and ready', () => {
    dispatchFromViewer(viewerReady);
    orchestrator.send(activate);
    fakeViewerWindow.postMessage.mockClear();

    orchestrator.dispose();

    expect(fakeViewerWindow.postMessage).toHaveBeenCalledTimes(1);
    const [posted, targetOrigin] = fakeViewerWindow.postMessage.mock.calls[0] as [unknown, string];
    expect(posted).toMatchObject({ type: 'DEACTIVATE_TOOL', rowId: 'row-1' });
    expect(targetOrigin).toBe(VIEWER_ORIGIN);
    expect(targetOrigin).not.toBe('*');
  });

  it('posts nothing on dispose when the viewer never became ready', () => {
    orchestrator.send(activate);
    fakeViewerWindow.postMessage.mockClear();

    orchestrator.dispose();

    expect(fakeViewerWindow.postMessage).not.toHaveBeenCalled();
  });

  it('posts nothing on dispose when the armed tool was already deactivated', () => {
    dispatchFromViewer(viewerReady);
    orchestrator.send(activate);
    orchestrator.send(deactivate);
    fakeViewerWindow.postMessage.mockClear();

    orchestrator.dispose();

    expect(fakeViewerWindow.postMessage).not.toHaveBeenCalled();
  });

  it('posts at most one DEACTIVATE_TOOL when dispose is called twice while armed', () => {
    dispatchFromViewer(viewerReady);
    orchestrator.send(activate);
    fakeViewerWindow.postMessage.mockClear();

    orchestrator.dispose();
    orchestrator.dispose();

    expect(fakeViewerWindow.postMessage).toHaveBeenCalledTimes(1);
  });

  it('posts nothing and does not throw on dispose when the viewer window no longer exists', () => {
    let viewerWindow: { postMessage: ReturnType<typeof vi.fn> } | null = fakeViewerWindow;
    const noWindowOrchestrator = createOrchestrator({
      getViewerWindow: () => viewerWindow as unknown as Window | null,
      viewerOrigin: VIEWER_ORIGIN,
    });
    window.dispatchEvent(new MessageEvent('message', { data: viewerReady, origin: VIEWER_ORIGIN }));
    noWindowOrchestrator.send(activate);
    viewerWindow = null;
    fakeViewerWindow.postMessage.mockClear();

    expect(() => {
      noWindowOrchestrator.dispose();
    }).not.toThrow();
    expect(fakeViewerWindow.postMessage).not.toHaveBeenCalled();
  });
});
