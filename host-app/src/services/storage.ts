import type { z } from 'zod';

export const readStorage = <T>(key: string, schema: z.ZodType<T>): T | null => {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.warn('[storage] failed to read', key, error);
    return null;
  }
};

export const writeStorage = (key: string, value: unknown): void => {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[storage] failed to write', key, error);
  }
};
