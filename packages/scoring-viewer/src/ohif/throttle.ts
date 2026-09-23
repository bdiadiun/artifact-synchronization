import type { MeasurementUpdatedEvent } from '@bdiadiun/scoring-contract';

export interface ThrottledEmitter {
  push: (key: string, event: MeasurementUpdatedEvent) => void;
  discard: (key: string) => void;
  clear: () => void;
}

export const createThrottledEmitter = (
  intervalMs: number,
  emit: (event: MeasurementUpdatedEvent) => void,
): ThrottledEmitter => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pending = new Map<string, MeasurementUpdatedEvent>();

  const push = (key: string, value: MeasurementUpdatedEvent): void => {
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

  const clear = (): void => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    pending.clear();
  };

  return { push, discard, clear };
};
