export interface ThrottledEmitter<T> {
  push: (key: string, value: T) => void;
  discard: (key: string) => void;
  dispose: () => void;
}

export type Emit<T> = (key: string, value: T) => void;

export interface KeyState<T> {
  lastEmitAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  // Wrapped so a falsy value is distinguishable from "nothing pending".
  pending: { value: T } | null;
}

export interface EmitterState<T> {
  keys: Map<string, KeyState<T>>;
  intervalMs: number;
  emit: Emit<T>;
}
