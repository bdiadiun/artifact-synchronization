import { LOG_PREFIX } from './peer.js';

export type Disposer = () => void;

export interface DisposerSet {
  add: (disposer: Disposer) => void;
  dispose: () => void;
}

export interface DisposerSetOptions {
  logPrefix?: string;
}

export const createDisposerSet = ({
  logPrefix = LOG_PREFIX,
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

  const add = (disposer: Disposer): void => {
    if (disposed) {
      release(disposer);
      return;
    }
    disposers.push(disposer);
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;

    for (const disposer of disposers.splice(0)) {
      release(disposer);
    }
  };

  return { add, dispose };
};
