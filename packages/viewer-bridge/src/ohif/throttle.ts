import type { ViewerEvent } from '@bdiadiun/scoring-contract';

interface ThrottledEmitter {
  push: (key: string, event: ViewerEvent) => void;
  discard: (key: string) => void;
  dispose: () => void;
}

export const createThrottledEmitter = (
  intervalMs: number,
  emit: (event: ViewerEvent) => void,
): ThrottledEmitter => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pending = new Map<string, ViewerEvent>();
  let disposed = false;

  const push = (key: string, value: ViewerEvent): void => {
    if (disposed) {
      return;
    }

    if (timers.has(key)) {
      pending.set(key, value);
      return;
    }

    emit(value);

    const timer = setTimeout(() => {
      timers.delete(key);
      const next = pending.get(key);
      pending.delete(key);

      if (next !== undefined) {
        push(key, next);
      }
    }, intervalMs);

    timers.set(key, timer);
  };

  const discard = (key: string): void => {
    clearTimeout(timers.get(key));
    timers.delete(key);
    pending.delete(key);
  };

  const dispose = (): void => {
    disposed = true;

    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    pending.clear();
  };

  return { push, discard, dispose };
};
