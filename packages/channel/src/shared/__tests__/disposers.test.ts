import { describe, expect, it, vi } from 'vitest';

import { createDisposerSet } from '../disposers';

describe('createDisposerSet', () => {
  it('runs disposers in the order they were registered', () => {
    const order: string[] = [];
    const disposers = createDisposerSet();

    disposers.add(() => order.push('first'));
    disposers.add(() => order.push('second'));
    disposers.add(() => order.push('third'));

    disposers.dispose();

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('runs each disposer exactly once even when disposed twice', () => {
    const disposer = vi.fn();
    const disposers = createDisposerSet();
    disposers.add(disposer);

    disposers.dispose();
    disposers.dispose();

    expect(disposer).toHaveBeenCalledTimes(1);
  });

  it('reports a throwing disposer and still runs the ones registered after it', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const survivor = vi.fn();
    const disposers = createDisposerSet({ logPrefix: '[test]' });

    disposers.add(() => {
      throw new Error('boom');
    });
    disposers.add(survivor);

    disposers.dispose();

    expect(survivor).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[test] disposer failed', expect.any(Error));

    warnSpy.mockRestore();
  });

  it('runs a disposer added after the set has already been released at once', () => {
    const lateDisposer = vi.fn();
    const disposers = createDisposerSet();

    disposers.dispose();
    disposers.add(lateDisposer);

    expect(lateDisposer).toHaveBeenCalledTimes(1);
  });

  it('reports, but does not propagate, a throw from a disposer added after release', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const disposers = createDisposerSet({ logPrefix: '[test]' });

    disposers.dispose();

    expect(() => {
      disposers.add(() => {
        throw new Error('boom');
      });
    }).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith('[test] disposer failed', expect.any(Error));

    warnSpy.mockRestore();
  });

  it('runs nothing a second time when an earlier disposer threw during release', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const survivor = vi.fn();
    const disposers = createDisposerSet();

    disposers.add(() => {
      throw new Error('boom');
    });
    disposers.add(survivor);

    disposers.dispose();
    disposers.dispose();

    expect(survivor).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
