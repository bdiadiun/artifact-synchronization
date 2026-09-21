import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerChildren } from '../registerChildren.js';
import type { OhifExtension, OhifExtensionManager } from '@bdiadiun/ohif-extension-scoring-bridge';

const makeChild = (id: string): OhifExtension => ({
  id,
  preRegistration: vi.fn(),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('registerChildren', () => {
  it('registers every child once, in declared order, and awaits each call', async () => {
    const calls: string[] = [];
    const manager: OhifExtensionManager = {
      registerExtension: vi.fn(async (extension: OhifExtension) => {
        calls.push(`start:${extension.id}`);
        await Promise.resolve();
        calls.push(`end:${extension.id}`);
      }),
    };
    const first = makeChild('first');
    const second = makeChild('second');

    await registerChildren(manager, [first, second]);

    expect(manager.registerExtension).toHaveBeenCalledTimes(2);
    expect(manager.registerExtension).toHaveBeenNthCalledWith(1, first);
    expect(manager.registerExtension).toHaveBeenNthCalledWith(2, second);
    expect(calls).toEqual(['start:first', 'end:first', 'start:second', 'end:second']);
  });

  it('reports a child whose registration throws synchronously and still registers the rest', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const thrown = new Error('broken registration');
    const manager: OhifExtensionManager = {
      registerExtension: vi.fn((extension: OhifExtension) => {
        if (extension.id === 'broken') {
          throw thrown;
        }
        return Promise.resolve();
      }),
    };
    const broken = makeChild('broken');
    const survivor = makeChild('survivor');

    await registerChildren(manager, [broken, survivor]);

    expect(manager.registerExtension).toHaveBeenCalledWith(survivor);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('broken'), thrown);
  });

  it('reports a child whose registration rejects and still registers the rest', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rejection = new Error('rejected registration');
    const manager: OhifExtensionManager = {
      registerExtension: vi.fn((extension: OhifExtension) => {
        if (extension.id === 'rejecting') {
          return Promise.reject(rejection);
        }
        return Promise.resolve();
      }),
    };
    const rejecting = makeChild('rejecting');
    const survivor = makeChild('survivor');

    await registerChildren(manager, [rejecting, survivor]);

    expect(manager.registerExtension).toHaveBeenCalledWith(survivor);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('rejecting'), rejection);
  });

  it('does nothing when there are no children to register', async () => {
    const manager: OhifExtensionManager = { registerExtension: vi.fn() };

    await registerChildren(manager, []);

    expect(manager.registerExtension).not.toHaveBeenCalled();
  });
});
