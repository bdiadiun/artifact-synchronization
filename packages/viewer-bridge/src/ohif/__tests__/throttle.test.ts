import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createThrottledEmitter } from '../throttle.js';

const INTERVAL_MS = 100;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createThrottledEmitter', () => {
  it('emits the first value for a key immediately', () => {
    const emit = vi.fn();
    const emitter = createThrottledEmitter(INTERVAL_MS, emit);

    emitter.push('a', 1);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('a', 1);
  });

  it('drops intermediate values within the interval and emits only the trailing one', () => {
    const emit = vi.fn();
    const emitter = createThrottledEmitter(INTERVAL_MS, emit);

    emitter.push('a', 1);
    emitter.push('a', 2);
    emitter.push('a', 3);

    expect(emit).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(INTERVAL_MS);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith('a', 3);
  });

  it('emits the value a drag ends on, not an intermediate one', () => {
    const emit = vi.fn();
    const emitter = createThrottledEmitter(INTERVAL_MS, emit);

    emitter.push('a', 1);
    emitter.push('a', 2);
    vi.advanceTimersByTime(50);
    emitter.push('a', 3);
    vi.advanceTimersByTime(50);

    expect(emit).toHaveBeenLastCalledWith('a', 3);
  });

  it('throttles each key independently, so one key cannot swallow another', () => {
    const emit = vi.fn();
    const emitter = createThrottledEmitter(INTERVAL_MS, emit);

    emitter.push('a', 1);
    emitter.push('b', 1);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith('a', 1);
    expect(emit).toHaveBeenCalledWith('b', 1);
  });

  it('discards a pending value for a key without emitting it', () => {
    const emit = vi.fn();
    const emitter = createThrottledEmitter(INTERVAL_MS, emit);

    emitter.push('a', 1);
    emitter.push('a', 2);
    emitter.discard('a');
    vi.advanceTimersByTime(INTERVAL_MS);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('a', 1);
  });

  it('stops emitting after dispose even when a timer was pending', () => {
    const emit = vi.fn();
    const emitter = createThrottledEmitter(INTERVAL_MS, emit);

    emitter.push('a', 1);
    emitter.push('a', 2);
    emitter.dispose();
    vi.advanceTimersByTime(INTERVAL_MS);
    emitter.push('a', 3);

    expect(emit).toHaveBeenCalledTimes(1);
  });
});
