// How both ends let go of what they hold (Q-5): in the order they registered it, once, and a
// disposer that throws is logged rather than stranding the ones behind it.

import { DEFAULT_LOG_PREFIX } from './config.js';

export type Disposer = () => void;

// What anything holding a listener, a timer or a subscription offers its owner (Q-5); declared
// once here and extended by both ends.
export interface Disposable {
  dispose: () => void;
}

export interface DisposerSet extends Disposable {
  // Release order is registration order, so the caller states its unmount order by adding in it.
  // Added after the release, a disposer is released at once rather than kept for a call that
  // will never come (Q-5).
  add: (disposer: Disposer) => void;
}

export interface DisposerSetOptions {
  logPrefix?: string;
}

export const createDisposerSet = ({
  logPrefix = DEFAULT_LOG_PREFIX,
}: DisposerSetOptions = {}): DisposerSet => {
  const disposers: Disposer[] = [];
  let disposed = false;

  const release = (disposer: Disposer): void => {
    try {
      disposer();
    } catch (error) {
      console.warn(`${logPrefix} disposer failed`, error);
    }
  };

  return {
    add: (disposer: Disposer): void => {
      if (disposed) {
        release(disposer);
        return;
      }
      disposers.push(disposer);
    },

    dispose: (): void => {
      if (disposed) {
        return;
      }
      disposed = true;

      // Drained before running, so a disposer that disposes the set again finds nothing left.
      for (const disposer of disposers.splice(0)) {
        release(disposer);
      }
    },
  };
};
