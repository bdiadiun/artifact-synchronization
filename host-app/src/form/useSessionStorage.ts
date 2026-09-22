import { useMemo } from 'react';

// One key of sessionStorage, as a value that is read and written whole. Every access is
// defensive: private mode, a full quota or a cleared store throw or return nothing, and the caller
// still has to render (A-14).
export interface SessionStorageSlot {
  getStorage: () => unknown;
  setStorage: (value: unknown) => void;
}

export const readSessionStorage = (key: string): unknown => {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (error) {
    console.warn(`[storage] failed to read ${key}`, error);
    return undefined;
  }
};

export const writeSessionStorage = (key: string, value: unknown): void => {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[storage] failed to write ${key}`, error);
  }
};

export const useSessionStorage = (key: string): SessionStorageSlot =>
  useMemo(
    () => ({
      getStorage: () => readSessionStorage(key),
      setStorage: (value: unknown) => {
        writeSessionStorage(key, value);
      },
    }),
    [key],
  );
