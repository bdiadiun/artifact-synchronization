export interface ThrottledEmitter<T> {
  push: (key: string, value: T) => void;
  discard: (key: string) => void;
  dispose: () => void;
}

type Emit<T> = (key: string, value: T) => void;

export const createThrottledEmitter = <T>(
  intervalMs: number,
  emit: Emit<T>,
): ThrottledEmitter<T> => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pending = new Map<string, T>();
  let disposed = false;

  const push = (key: string, value: T): void => {
    if (disposed) {
      return;
    }

    if (timers.has(key)) {
      pending.set(key, value);
      return;
    }

    emit(key, value);

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
