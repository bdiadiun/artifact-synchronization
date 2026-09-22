// Leading + trailing, so the value a handle is released on is always the last one emitted.
// Per key, so one annotation's drag cannot swallow another annotation's final value.

export interface ThrottledEmitter<T> {
  push: (key: string, value: T) => void;
  discard: (key: string) => void;
  dispose: () => void;
}

type Emit<T> = (key: string, value: T) => void;

interface KeyState<T> {
  lastEmitAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  // Wrapped so a falsy value is distinguishable from "nothing pending".
  pending: { value: T } | null;
}

const stopTimer = <T>(state: KeyState<T>): void => {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
};

export const createThrottledEmitter = <T>(
  intervalMs: number,
  emit: Emit<T>,
): ThrottledEmitter<T> => {
  const keys = new Map<string, KeyState<T>>();
  let disposed = false;

  const emitNow = (key: string, state: KeyState<T>, value: T): void => {
    state.lastEmitAt = Date.now();
    state.pending = null;
    emit(key, value);
  };

  const emitPendingLater = (key: string, state: KeyState<T>, delayMs: number): void => {
    state.timer = setTimeout(() => {
      state.timer = null;
      const pending = state.pending;

      if (pending) {
        emitNow(key, state, pending.value);
      }
    }, delayMs);
  };

  const push = (key: string, value: T): void => {
    if (disposed) {
      return;
    }

    const state = keys.get(key) ?? { lastEmitAt: null, timer: null, pending: null };
    keys.set(key, state);
    state.pending = { value };

    if (state.timer !== null) {
      return;
    }

    const elapsed = state.lastEmitAt === null ? Infinity : Date.now() - state.lastEmitAt;

    if (elapsed >= intervalMs) {
      emitNow(key, state, value);
      return;
    }

    emitPendingLater(key, state, intervalMs - elapsed);
  };

  return {
    push,

    discard: (key: string): void => {
      const state = keys.get(key);

      if (!state) {
        return;
      }

      stopTimer(state);
      state.pending = null;
      keys.delete(key);
    },

    dispose: (): void => {
      disposed = true;

      for (const state of keys.values()) {
        stopTimer(state);
        state.pending = null;
      }

      keys.clear();
    },
  };
};
