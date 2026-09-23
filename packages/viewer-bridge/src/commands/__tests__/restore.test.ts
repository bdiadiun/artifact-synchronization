// Rebuilding annotations the host persisted (A-14, S-5.6). Cornerstone is mocked: what is under
// test is which rows the bridge restores, what it refuses and what it answers, not cornerstone's
// annotation store.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { annotation } from '@cornerstonejs/tools';
import { triggerAnnotationRenderForViewportIds } from '@cornerstonejs/tools/utilities';
import { isHostCommand } from '@bdiadiun/scoring-contract';
import { createChannel } from '@bdiadiun/scoring-channel';
import type { ViewerChannel } from '../../ohif/surface.js';
import type {
  RestoreMeasurementRequest,
  RestoreMeasurementsCommand,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';

import type { Bridge, Ohif } from '../../bridge.js';
import { handleCommand } from '../handlers.js';
import { subscribeViewportData } from '../restore.js';
import type { OhifServices, OhifSubscription } from '../../ohif/surface.js';
import { createServices, STUDY_UID, VIEWPORT_ID } from '../../__tests__/helpers.js';

vi.mock('@cornerstonejs/tools', () => ({
  annotation: { state: { addAnnotation: vi.fn() } },
}));

vi.mock('@cornerstonejs/tools/utilities', () => ({
  triggerAnnotationRenderForViewportIds: vi.fn(),
}));

// The bridge as the hook builds it: a channel plus the two pieces of state, subscribed to
// VIEWPORT_DATA_CHANGED the way `useScoringBridge` does.
const bridgeFor = (
  services: OhifServices,
  channel: ViewerChannel,
): { ohif: Ohif; bridge: Bridge; unsubscribe: () => void } => {
  const ohif: Ohif = { services, commandsManager: { runCommand: vi.fn() } };
  const bridge: Bridge = { channel, armedRowId: null, pendingRestore: null };
  const unsubscribe = subscribeViewportData(ohif, bridge);
  return { ohif, bridge, unsubscribe };
};

const HOST_ORIGIN = 'http://localhost:5173';

const request = (rowId: string, measurementUid: string): RestoreMeasurementRequest => ({
  rowId,
  measurementUid,
  toolName: 'EllipticalROI',
  geometry: {
    frameOfReferenceUid: 'frame-1',
    referencedImageId: 'image-1',
    points: [
      [1, 2, 3],
      [4, 5, 6],
    ],
    label: 'Lesion A',
  },
});

const restoreCommand = (
  measurements: RestoreMeasurementRequest[],
  studyInstanceUid = STUDY_UID,
): RestoreMeasurementsCommand => ({
  type: 'RESTORE_MEASUREMENTS',
  studyInstanceUid,
  measurements,
});

interface ViewportGate {
  holdsData: boolean;
  handlers: (() => void)[];
  unsubscribe: Mock<() => void>;
}

const createViewportGate = (holdsData: boolean): ViewportGate => ({
  holdsData,
  handlers: [],
  unsubscribe: vi.fn(),
});

const servicesFor = (gate: ViewportGate, knownUids: string[] = []): OhifServices =>
  createServices({
    measurementService: {
      EVENTS: { MEASUREMENT_ADDED: 'a', MEASUREMENT_UPDATED: 'u', MEASUREMENT_REMOVED: 'r' },
      subscribe: () => ({ unsubscribe: vi.fn() }),
      getMeasurement: (uid: string) => (knownUids.includes(uid) ? { uid } : undefined),
      remove: vi.fn(),
      jumpToMeasurement: vi.fn(),
    },
    cornerstoneViewportService: {
      EVENTS: { VIEWPORT_DATA_CHANGED: 'VIEWPORT_DATA_CHANGED' },
      subscribe: (_eventName: string, handler: () => void): OhifSubscription => {
        gate.handlers.push(handler);
        return { unsubscribe: gate.unsubscribe };
      },
      getCornerstoneViewport: () => (gate.holdsData ? {} : null),
    },
  });

interface RestoreFixture {
  channel: ViewerChannel;
  posted: () => ViewerEvent[];
}

const connect = (): RestoreFixture => {
  const hostWindow = { postMessage: vi.fn() };
  vi.spyOn(window, 'parent', 'get').mockReturnValue(hostWindow as unknown as Window);
  const channel = createChannel({
    peerOrigin: HOST_ORIGIN,
    peerWindow: window.parent,
    accept: isHostCommand,
  });

  return {
    channel,
    posted: () => hostWindow.postMessage.mock.calls.map(([message]) => message as ViewerEvent),
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(annotation.state.addAnnotation).mockReset();
  vi.mocked(triggerAnnotationRenderForViewportIds).mockReset();
});

describe('restoring measurements (A-14)', () => {
  it('answers with the rows it restored', () => {
    const { channel, posted } = connect();
    const { ohif, bridge } = bridgeFor(servicesFor(createViewportGate(true)), channel);

    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')]));

    expect(posted()).toEqual([
      {
        version: 1,
        type: 'MEASUREMENTS_RESTORED',
        restored: ['row-1'],
        failed: [],
      },
    ]);
    channel.dispose();
  });

  it('adds the annotation under the frame of reference the host persisted', () => {
    const { channel } = connect();
    const { ohif, bridge } = bridgeFor(servicesFor(createViewportGate(true)), channel);

    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')]));

    expect(annotation.state.addAnnotation).toHaveBeenCalledWith(
      {
        annotationUID: 'uid-1',
        metadata: {
          toolName: 'EllipticalROI',
          FrameOfReferenceUID: 'frame-1',
          referencedImageId: 'image-1',
        },
        data: {
          handles: {
            points: [
              [1, 2, 3],
              [4, 5, 6],
            ],
            activeHandleIndex: null,
          },
          label: 'Lesion A',
        },
        invalidated: true,
      },
      'frame-1',
    );
    channel.dispose();
  });

  it('renders the active viewport once something was restored', () => {
    const { channel } = connect();
    const { ohif, bridge } = bridgeFor(servicesFor(createViewportGate(true)), channel);

    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')]));

    expect(triggerAnnotationRenderForViewportIds).toHaveBeenCalledWith([VIEWPORT_ID]);
    channel.dispose();
  });

  it('fails every row with unknown-study when the viewer shows a different study', () => {
    const { channel, posted } = connect();
    const { ohif, bridge } = bridgeFor(servicesFor(createViewportGate(true)), channel);

    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')], 'another-study'));

    expect(posted()[0]).toMatchObject({
      restored: [],
      failed: [{ rowId: 'row-1', reason: 'unknown-study' }],
    });
    expect(annotation.state.addAnnotation).not.toHaveBeenCalled();
    channel.dispose();
  });

  it('fails a row whose measurement the viewer already holds', () => {
    const { channel, posted } = connect();
    const { ohif, bridge } = bridgeFor(servicesFor(createViewportGate(true), ['uid-1']), channel);

    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')]));

    expect(posted()[0]).toMatchObject({
      restored: [],
      failed: [{ rowId: 'row-1', reason: 'already-present' }],
    });
    expect(annotation.state.addAnnotation).not.toHaveBeenCalled();
    channel.dispose();
  });

  it('fails a row with viewer-error when adding the annotation throws', () => {
    const { channel, posted } = connect();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(annotation.state.addAnnotation).mockImplementation(() => {
      throw new Error('no enabled element');
    });
    const { ohif, bridge } = bridgeFor(servicesFor(createViewportGate(true)), channel);

    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')]));

    expect(posted()[0]).toMatchObject({
      restored: [],
      failed: [{ rowId: 'row-1', reason: 'viewer-error' }],
    });
    channel.dispose();
  });
});

describe('waiting for the viewport to hold data', () => {
  it('restores nothing until the viewport reports its data', () => {
    const { channel, posted } = connect();
    const gate = createViewportGate(false);
    const { ohif, bridge } = bridgeFor(servicesFor(gate), channel);

    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')]));

    expect(posted()).toEqual([]);

    gate.holdsData = true;
    gate.handlers.forEach((handler) => {
      handler();
    });

    expect(posted()[0]).toMatchObject({ restored: ['row-1'] });
    expect(bridge.pendingRestore).toBeNull();
    channel.dispose();
  });

  it('releases the viewport subscription when the bridge unmounts', () => {
    const { channel, posted } = connect();
    const gate = createViewportGate(false);
    const { ohif, bridge, unsubscribe } = bridgeFor(servicesFor(gate), channel);
    handleCommand(ohif, bridge, restoreCommand([request('row-1', 'uid-1')]));

    unsubscribe();

    expect(gate.unsubscribe).toHaveBeenCalledTimes(1);
    expect(posted()).toEqual([]);
    channel.dispose();
  });
});
