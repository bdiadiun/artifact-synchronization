import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBridge } from '../bridge';
import type {
  OhifCommandsManager,
  OhifMeasurementEvent,
  OhifMeasurementService,
  OhifServicesManager,
} from '../ohif.props';

const HOST_ORIGIN = 'http://host.example.com';

const dispatchFromHost = (data: unknown, origin = HOST_ORIGIN): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
};

interface FakeToolGroupService {
  service: {
    getToolGroup: () => { id: string; hasTool: () => boolean };
    getActivePrimaryMouseButtonTool: () => string;
    subscribe: (event: string, handler: () => void) => { unsubscribe: () => void };
    EVENTS: { VIEWPORT_ADDED: string };
  };
  unsubscribeSpy: ReturnType<typeof vi.fn>;
}

const createFakeToolGroupService = (order: string[]): FakeToolGroupService => {
  const unsubscribeSpy = vi.fn(() => order.push('handshake.dispose'));

  return {
    unsubscribeSpy,
    service: {
      getToolGroup: () => ({ id: 'group-1', hasTool: () => true }),
      getActivePrimaryMouseButtonTool: () => 'WindowLevel',
      subscribe: () => ({ unsubscribe: unsubscribeSpy }),
      EVENTS: { VIEWPORT_ADDED: 'VIEWPORT_ADDED' },
    },
  };
};

const armRow = (rowId: string): void => {
  dispatchFromHost({
    version: 1,
    type: 'ACTIVATE_TOOL',
    requestId: 'req-1',
    rowId,
    toolName: 'EllipticalROI',
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createBridge dispose ordering', () => {
  it('restores the doctor tool before the message subscription goes away', () => {
    const order: string[] = [];
    const originalRemoveEventListener = window.removeEventListener.bind(window);
    vi.spyOn(window, 'removeEventListener').mockImplementation((...args) => {
      if (args[0] === 'message') {
        order.push('listener.dispose');
      }
      originalRemoveEventListener(...(args as Parameters<typeof window.addEventListener>));
    });
    const { service: toolGroupService } = createFakeToolGroupService(order);
    const commandsManager: OhifCommandsManager = {
      runCommand: vi.fn(() => order.push('runCommand')),
    };
    const servicesManager: OhifServicesManager = { services: { toolGroupService } };

    const bridge = createBridge({ servicesManager, commandsManager, hostOrigin: HOST_ORIGIN });
    armRow('row-1');

    order.length = 0;
    bridge.dispose();

    expect(order[0]).toBe('runCommand');
    expect(order).toEqual(
      expect.arrayContaining(['runCommand', 'handshake.dispose', 'listener.dispose']),
    );
    expect(order.indexOf('runCommand')).toBeLessThan(order.indexOf('handshake.dispose'));
    expect(order.indexOf('runCommand')).toBeLessThan(order.indexOf('listener.dispose'));
  });

  it('does not strand the remaining subscriptions when restoring the tool throws', () => {
    const order: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { service: toolGroupService, unsubscribeSpy } = createFakeToolGroupService(order);
    let throwOnRestore = false;
    const commandsManager: OhifCommandsManager = {
      runCommand: vi.fn(() => {
        if (throwOnRestore) {
          throw new Error('tool restore failed');
        }
      }),
    };
    const servicesManager: OhifServicesManager = { services: { toolGroupService } };

    const bridge = createBridge({ servicesManager, commandsManager, hostOrigin: HOST_ORIGIN });
    armRow('row-1');
    throwOnRestore = true;

    expect(() => {
      bridge.dispose();
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});

interface FakeMeasurementService {
  service: OhifMeasurementService;
  handlers: Map<string, (event: OhifMeasurementEvent) => void>;
}

const createFakeMeasurementService = (): FakeMeasurementService => {
  const handlers = new Map<string, (event: OhifMeasurementEvent) => void>();

  return {
    handlers,
    service: {
      EVENTS: {
        MEASUREMENT_ADDED: 'MEASUREMENT_ADDED',
        MEASUREMENT_UPDATED: 'MEASUREMENT_UPDATED',
        MEASUREMENT_REMOVED: 'MEASUREMENT_REMOVED',
      },
      subscribe: (eventName, handler) => {
        handlers.set(eventName, handler);
        return { unsubscribe: vi.fn() };
      },
      getMeasurement: vi.fn(),
      remove: vi.fn(),
      jumpToMeasurement: vi.fn(),
    },
  };
};

const ellipticalMeasurement = (uid: string): OhifMeasurementEvent['measurement'] => ({
  uid,
  toolName: 'EllipticalROI',
  referencedImageId: 'image-1',
  data: { 'imageId:image-1': { area: 12.5, areaUnit: 'mm2' } },
});

describe('createBridge end-to-end (A-21)', () => {
  const setUp = (): {
    hostWindow: { postMessage: ReturnType<typeof vi.fn> };
    commandsManager: OhifCommandsManager;
    measurementService: FakeMeasurementService;
  } => {
    const hostWindow = { postMessage: vi.fn() };
    vi.spyOn(window, 'parent', 'get').mockReturnValue(hostWindow as unknown as Window);
    const { service: toolGroupService } = createFakeToolGroupService([]);
    const measurementService = createFakeMeasurementService();
    const commandsManager: OhifCommandsManager = { runCommand: vi.fn() };
    const servicesManager: OhifServicesManager = {
      services: { toolGroupService, measurementService: measurementService.service },
    };

    createBridge({ servicesManager, commandsManager, hostOrigin: HOST_ORIGIN });

    return { hostWindow, commandsManager, measurementService };
  };

  it('ACTIVATE_TOOL arms the row and activates the requested tool', () => {
    const { commandsManager } = setUp();

    armRow('row-1');

    expect(commandsManager.runCommand).toHaveBeenCalledWith('setToolActive', {
      toolName: 'EllipticalROI',
    });
  });

  it('ignores a command from any origin other than the configured host', () => {
    const { commandsManager } = setUp();

    dispatchFromHost(
      {
        version: 1,
        type: 'ACTIVATE_TOOL',
        requestId: 'req-1',
        rowId: 'row-1',
        toolName: 'EllipticalROI',
      },
      'http://evil.example',
    );

    expect(commandsManager.runCommand).not.toHaveBeenCalled();
  });

  it('sends MEASUREMENT_ADDED with version 1, the armed rowId and the causing requestId', () => {
    const { hostWindow, measurementService } = setUp();
    armRow('row-1');

    measurementService.handlers.get('MEASUREMENT_ADDED')?.({
      measurement: ellipticalMeasurement('uid-1'),
    });

    expect(hostWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        type: 'MEASUREMENT_ADDED',
        rowId: 'row-1',
        measurementUid: 'uid-1',
        causedBy: 'req-1',
      }),
      HOST_ORIGIN,
    );
  });

  it('answers REMOVE_MEASUREMENT with causedBy once the measurement is actually removed', () => {
    const { hostWindow, measurementService } = setUp();
    (measurementService.service.getMeasurement as ReturnType<typeof vi.fn>).mockReturnValue(
      ellipticalMeasurement('uid-1'),
    );
    (measurementService.service.remove as ReturnType<typeof vi.fn>).mockImplementation(
      (uid: string) => {
        measurementService.handlers.get('MEASUREMENT_REMOVED')?.({ measurement: uid });
      },
    );

    dispatchFromHost({
      version: 1,
      type: 'REMOVE_MEASUREMENT',
      requestId: 'req-2',
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });

    expect(measurementService.service.remove).toHaveBeenCalledWith('uid-1');
    expect(hostWindow.postMessage).toHaveBeenCalledWith(
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: 'req-2' },
      HOST_ORIGIN,
    );
  });

  it('answers REMOVE_MEASUREMENT with causedBy without calling remove() when the measurement is already gone', () => {
    const { hostWindow, measurementService } = setUp();
    (measurementService.service.getMeasurement as ReturnType<typeof vi.fn>).mockReturnValue(
      undefined,
    );

    dispatchFromHost({
      version: 1,
      type: 'REMOVE_MEASUREMENT',
      requestId: 'req-3',
      rowId: 'row-1',
      measurementUid: 'uid-1',
    });

    expect(measurementService.service.remove).not.toHaveBeenCalled();
    expect(hostWindow.postMessage).toHaveBeenCalledWith(
      { version: 1, type: 'MEASUREMENT_REMOVED', measurementUid: 'uid-1', causedBy: 'req-3' },
      HOST_ORIGIN,
    );
  });
});
