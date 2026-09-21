import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBridge } from '../bridge';
import type { OhifCommandsManager, OhifServicesManager } from '../ohif.props';

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
