// The bridge as OHIF sees it (A-23): the extension is started with fake services and a fake host
// window, and every scenario is driven the way the viewer drives it — a message from the host
// origin, or an event from the measurement service.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostCommand, ViewerEvent, ViewerReadyEvent } from '@bdiadiun/scoring-contract';

import { createScoringBridgeExtension } from '../extension.js';
import type {
  OhifExtensionParams,
  OhifMeasurementEvent,
  OhifMeasurementLike,
  OhifMeasurementService,
  OhifToolGroupService,
} from '../ohif/surface.js';

const HOST_ORIGIN = 'http://localhost:5173';
const VIEWPORT_ID = 'viewport-1';
const UPDATE_INTERVAL_MS = 100;

const EVENTS = {
  MEASUREMENT_ADDED: 'MEASUREMENT_ADDED',
  MEASUREMENT_UPDATED: 'MEASUREMENT_UPDATED',
  MEASUREMENT_REMOVED: 'MEASUREMENT_REMOVED',
};

const ellipse = (uid: string, area = 12.5): OhifMeasurementLike => ({
  uid,
  toolName: 'EllipticalROI',
  referencedImageId: 'image-1',
  data: { 'imageId:image-1': { area, areaUnit: 'mm2' } },
  points: [
    [1, 2, 3],
    [4, 5, 6],
  ],
  label: 'Lesion A',
  metadata: { FrameOfReferenceUID: 'frame-1' },
});

const ELLIPSE_GEOMETRY = {
  frameOfReferenceUid: 'frame-1',
  referencedImageId: 'image-1',
  points: [
    [1, 2, 3],
    [4, 5, 6],
  ],
  label: 'Lesion A',
};

const activateTool = (rowId: string, requestId = 'req-1'): HostCommand => ({
  type: 'ACTIVATE_TOOL',
  requestId,
  rowId,
  toolName: 'EllipticalROI',
});

const deactivateTool = (rowId: string): HostCommand => ({
  type: 'DEACTIVATE_TOOL',
  requestId: 'req-2',
  rowId,
});

const removeMeasurement = (measurementUid: string, requestId = 'req-3'): HostCommand => ({
  type: 'REMOVE_MEASUREMENT',
  requestId,
  rowId: 'row-1',
  measurementUid,
});

const focusMeasurement = (measurementUid: string): HostCommand => ({
  type: 'FOCUS_MEASUREMENT',
  requestId: 'req-4',
  rowId: 'row-1',
  measurementUid,
});

// The contract version lives on the wire, not in the message types (A-25), so it is stamped here
// the way the host's channel stamps it; without it the bridge's channel drops the command.
const dispatchCommand = (command: HostCommand, origin = HOST_ORIGIN): void => {
  window.dispatchEvent(new MessageEvent('message', { data: { version: 1, ...command }, origin }));
};

type Mock = ReturnType<typeof vi.fn>;

interface BridgeFixture {
  runCommand: Mock;
  toolGroup: { id: string; hasTool: Mock };
  measurementService: OhifMeasurementService;
  emit: (eventName: string, measurement: OhifMeasurementLike | string) => void;
  addViewport: () => void;
  unsubscribes: { measurement: Mock; viewport: Mock };
  posted: () => ViewerEvent[];
}

const startExtension = (): BridgeFixture => {
  const hostWindow = { postMessage: vi.fn() };
  vi.spyOn(window, 'parent', 'get').mockReturnValue(hostWindow as unknown as Window);

  const measurementHandlers = new Map<string, (event: OhifMeasurementEvent) => void>();
  const viewportHandlers: (() => void)[] = [];
  const unsubscribes = { measurement: vi.fn(), viewport: vi.fn() };
  const toolGroup = { id: 'group-1', hasTool: vi.fn().mockReturnValue(true) };
  const runCommand = vi.fn();

  const measurementService: OhifMeasurementService = {
    EVENTS,
    subscribe: (eventName, handler) => {
      measurementHandlers.set(eventName, handler);
      return { unsubscribe: unsubscribes.measurement };
    },
    getMeasurement: vi.fn(),
    remove: vi.fn(),
    jumpToMeasurement: vi.fn(),
  };

  const toolGroupService: OhifToolGroupService = {
    EVENTS: { VIEWPORT_ADDED: 'VIEWPORT_ADDED' },
    subscribe: (_eventName, handler) => {
      viewportHandlers.push(handler);
      return { unsubscribe: unsubscribes.viewport };
    },
    getToolGroup: () => toolGroup,
  };

  const params: OhifExtensionParams = {
    servicesManager: {
      services: {
        measurementService,
        toolGroupService,
        viewportGridService: { getActiveViewportId: () => VIEWPORT_ID },
      },
    },
    commandsManager: { runCommand },
  };
  createScoringBridgeExtension({ hostOrigin: HOST_ORIGIN }).preRegistration(params);

  return {
    runCommand,
    toolGroup,
    measurementService,
    unsubscribes,
    emit: (eventName, measurement) => {
      measurementHandlers.get(eventName)?.({ measurement });
    },
    addViewport: () => {
      viewportHandlers.forEach((handler) => {
        handler();
      });
    },
    posted: () => hostWindow.postMessage.mock.calls.map(([message]) => message as ViewerEvent),
  };
};

const mockedRemoval = (fixture: BridgeFixture): void => {
  const { measurementService, emit } = fixture;
  (measurementService.getMeasurement as Mock).mockReturnValue(ellipse('uid-1'));
  (measurementService.remove as Mock).mockImplementation((uid: string) => {
    emit(EVENTS.MEASUREMENT_REMOVED, uid);
  });
};

afterEach(() => {
  // The bridge has no other way out: the extension releases it when the page goes away (Q-5).
  window.dispatchEvent(new Event('pagehide'));
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the host origin the bridge is configured with (Q-2)', () => {
  const inertParams: OhifExtensionParams = {
    servicesManager: { services: {} },
    commandsManager: { runCommand: vi.fn() },
  };

  it('leaves the bridge inert when no host origin is configured anywhere', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    createScoringBridgeExtension().preRegistration(inertParams);

    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything());
    expect(addSpy).not.toHaveBeenCalledWith('pagehide', expect.anything());
    expect(errorSpy).toHaveBeenCalled();
  });

  it('leaves the bridge inert when the configured host origin is an empty string', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    createScoringBridgeExtension({ hostOrigin: '' }).preRegistration(inertParams);

    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything());
  });

  it('does not fall back to a permissive origin when appConfig carries none either', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    createScoringBridgeExtension().preRegistration({ ...inertParams, appConfig: {} });

    expect(addSpy).not.toHaveBeenCalledWith('message', expect.anything());
  });

  it('arms the bridge once a host origin is configured', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    createScoringBridgeExtension({ hostOrigin: HOST_ORIGIN }).preRegistration(inertParams);

    expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('ignores a command from any origin other than the configured host', () => {
    const { runCommand } = startExtension();

    dispatchCommand(activateTool('row-1'), 'http://evil.example');

    expect(runCommand).not.toHaveBeenCalled();
  });
});

describe('announcing the viewer (Q-1)', () => {
  it('announces itself with its version once a viewport has a tool group', () => {
    const { addViewport, posted } = startExtension();

    addViewport();

    const [announcement] = posted() as [ViewerReadyEvent];
    expect(announcement).toMatchObject({ version: 1, type: 'VIEWER_READY' });
    expect(announcement.viewerVersion.length).toBeGreaterThan(0);
  });

  it('announces itself once however many viewports are added', () => {
    const { addViewport, posted } = startExtension();

    addViewport();
    addViewport();

    expect(posted()).toHaveLength(1);
  });
});

describe('arming a row (C-4.3.4)', () => {
  it('activates the tool the command names', () => {
    const { runCommand } = startExtension();

    dispatchCommand(activateTool('row-1'));

    expect(runCommand).toHaveBeenCalledWith('setToolActive', { toolName: 'EllipticalROI' });
  });

  it('runs no command and reports the error when the tool group has no such tool', () => {
    const fixture = startExtension();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fixture.toolGroup.hasTool.mockReturnValue(false);

    dispatchCommand(activateTool('row-1'));

    expect(fixture.runCommand).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('restores the default tool when the armed row is deactivated', () => {
    const { runCommand } = startExtension();
    dispatchCommand(activateTool('row-1'));
    runCommand.mockClear();

    dispatchCommand(deactivateTool('row-1'));

    expect(runCommand).toHaveBeenCalledWith('setToolActive', { toolName: 'WindowLevel' });
  });

  it('keeps the tool when a row other than the armed one is deactivated', () => {
    const { runCommand } = startExtension();
    dispatchCommand(activateTool('row-1'));
    runCommand.mockClear();

    dispatchCommand(deactivateTool('row-2'));

    expect(runCommand).not.toHaveBeenCalled();
  });
});

describe('a measurement the doctor drew (C-4.3.5, A-8)', () => {
  it('posts it with the armed row, the request that armed it, its metrics and its geometry', () => {
    const { emit, posted } = startExtension();
    dispatchCommand(activateTool('row-1', 'req-1'));

    emit(EVENTS.MEASUREMENT_ADDED, ellipse('uid-1'));

    expect(posted()).toEqual([
      {
        version: 1,
        type: 'MEASUREMENT_ADDED',
        rowId: 'row-1',
        measurementUid: 'uid-1',
        toolName: 'EllipticalROI',
        metrics: { area: { value: 12.5, unit: 'mm2' } },
        causedBy: 'req-1',
        geometry: ELLIPSE_GEOMETRY,
      },
    ]);
  });

  it('releases the row to the default tool after the measurement is posted', () => {
    const { emit, runCommand } = startExtension();
    dispatchCommand(activateTool('row-1'));
    runCommand.mockClear();

    emit(EVENTS.MEASUREMENT_ADDED, ellipse('uid-1'));

    expect(runCommand).toHaveBeenCalledWith('setToolActive', { toolName: 'WindowLevel' });
  });

  it('posts a drawing made while nothing is armed with no row and no cause, leaving the tool alone', () => {
    const { emit, posted, runCommand } = startExtension();

    emit(EVENTS.MEASUREMENT_ADDED, ellipse('uid-1'));

    expect(posted()).toEqual([
      {
        version: 1,
        type: 'MEASUREMENT_ADDED',
        rowId: null,
        measurementUid: 'uid-1',
        toolName: 'EllipticalROI',
        metrics: { area: { value: 12.5, unit: 'mm2' } },
        geometry: ELLIPSE_GEOMETRY,
      },
    ]);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('posts nothing and keeps the row armed when the measurement carries no value it can name', () => {
    const { emit, posted, runCommand } = startExtension();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    dispatchCommand(activateTool('row-1'));
    runCommand.mockClear();

    emit(EVENTS.MEASUREMENT_ADDED, { uid: 'uid-1', toolName: 'EllipticalROI' });

    expect(posted()).toEqual([]);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('posts nothing for an added payload that carries no measurement object', () => {
    const { emit, posted } = startExtension();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    emit(EVENTS.MEASUREMENT_ADDED, 'just-a-uid-string');

    expect(posted()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('updates while the doctor drags (S-5.1)', () => {
  it('posts the first update at once and the last one of the interval when it expires', () => {
    vi.useFakeTimers();
    const { emit, posted } = startExtension();

    emit(EVENTS.MEASUREMENT_UPDATED, ellipse('uid-1', 10));
    emit(EVENTS.MEASUREMENT_UPDATED, ellipse('uid-1', 20));
    emit(EVENTS.MEASUREMENT_UPDATED, ellipse('uid-1', 30));

    expect(posted()).toHaveLength(1);
    expect(posted()[0]).toMatchObject({
      type: 'MEASUREMENT_UPDATED',
      measurementUid: 'uid-1',
      metrics: { area: { value: 10, unit: 'mm2' } },
    });

    vi.advanceTimersByTime(UPDATE_INTERVAL_MS);

    expect(posted()).toHaveLength(2);
    expect(posted()[1]).toMatchObject({
      metrics: { area: { value: 30, unit: 'mm2' } },
    });
  });

  it('never posts an update the removal of that measurement overtook', () => {
    vi.useFakeTimers();
    const { emit, posted } = startExtension();

    emit(EVENTS.MEASUREMENT_UPDATED, ellipse('uid-1', 10));
    emit(EVENTS.MEASUREMENT_UPDATED, ellipse('uid-1', 20));
    emit(EVENTS.MEASUREMENT_REMOVED, 'uid-1');
    vi.advanceTimersByTime(UPDATE_INTERVAL_MS);

    expect(posted().map((message) => message.type)).toEqual([
      'MEASUREMENT_UPDATED',
      'MEASUREMENT_REMOVED',
    ]);
  });
});

describe('removing a measurement (A-10)', () => {
  it('removes it and answers the command that asked for it', () => {
    const fixture = startExtension();
    mockedRemoval(fixture);

    dispatchCommand(removeMeasurement('uid-1', 'req-3'));

    expect(fixture.measurementService.remove).toHaveBeenCalledWith('uid-1');
    expect(fixture.posted()).toEqual([
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: 'req-3' },
    ]);
  });

  it('answers a command for a measurement that is already gone without removing anything', () => {
    const fixture = startExtension();
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    (fixture.measurementService.getMeasurement as Mock).mockReturnValue(undefined);

    dispatchCommand(removeMeasurement('uid-1', 'req-3'));

    expect(fixture.measurementService.remove).not.toHaveBeenCalled();
    expect(fixture.posted()).toEqual([
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: 'req-3' },
    ]);
  });

  it('reports a deletion made in the viewer as an event of its own, caused by nothing', () => {
    const { emit, posted } = startExtension();

    emit(EVENTS.MEASUREMENT_REMOVED, 'uid-1');

    expect(posted()).toEqual([
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1' },
    ]);
  });

  it('posts nothing for a removal that names no uid', () => {
    const { emit, posted } = startExtension();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    emit(EVENTS.MEASUREMENT_REMOVED, { uid: 'uid-1' });

    expect(posted()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('focusing a measurement (S-5.3)', () => {
  it('jumps the active viewport to the measurement the command names', () => {
    const { measurementService } = startExtension();
    (measurementService.getMeasurement as Mock).mockReturnValue(ellipse('uid-1'));

    dispatchCommand(focusMeasurement('uid-1'));

    expect(measurementService.jumpToMeasurement).toHaveBeenCalledWith(VIEWPORT_ID, 'uid-1');
  });

  it('jumps nowhere for a uid the viewer does not hold', () => {
    const { measurementService } = startExtension();
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    (measurementService.getMeasurement as Mock).mockReturnValue(undefined);

    dispatchCommand(focusMeasurement('uid-9'));

    expect(measurementService.jumpToMeasurement).not.toHaveBeenCalled();
  });
});

describe('letting go when the page goes away (Q-5)', () => {
  it('restores the default tool the armed row left behind', () => {
    const { runCommand } = startExtension();
    dispatchCommand(activateTool('row-1'));
    runCommand.mockClear();

    window.dispatchEvent(new Event('pagehide'));

    expect(runCommand).toHaveBeenCalledWith('setToolActive', { toolName: 'WindowLevel' });
  });

  it('unsubscribes every OHIF subscription it took', () => {
    const { unsubscribes } = startExtension();

    window.dispatchEvent(new Event('pagehide'));

    expect(unsubscribes.measurement).toHaveBeenCalledTimes(3);
    expect(unsubscribes.viewport).toHaveBeenCalledTimes(1);
  });

  it('leaves no message listener behind, so a later command reaches nothing', () => {
    const { runCommand } = startExtension();

    window.dispatchEvent(new Event('pagehide'));
    dispatchCommand(activateTool('row-1'));

    expect(runCommand).not.toHaveBeenCalled();
  });
});
