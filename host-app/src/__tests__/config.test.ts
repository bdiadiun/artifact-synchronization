import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ConfigModule from '@app/config';

const VIEWER_URL_PREFIX = 'http://localhost:3000/viewer?StudyInstanceUIDs=';

const setStudyParam = (value: string | null): void => {
  const url = new URL('http://localhost:3000/');
  if (value !== null) {
    url.searchParams.set('study', value);
  }
  window.history.pushState({}, '', url);
};

// The resolution is memoised per module instance, so each case needs a module that has never
// resolved before: reset modules, set the URL, then import fresh.
const loadConfig = async (): Promise<typeof ConfigModule> => {
  vi.resetModules();
  return import('@app/config');
};

afterEach(() => {
  window.history.pushState({}, '', 'http://localhost:3000/');
});

describe('getStudyInstance', () => {
  it('resolves to the fallback when the page URL has no study parameter', async () => {
    setStudyParam(null);
    const { getStudyInstance, FALLBACK_STUDY_INSTANCE_UID } = await loadConfig();

    expect(getStudyInstance()).toBe(FALLBACK_STUDY_INSTANCE_UID);
  });

  it('resolves to the study parameter when it is a valid study instance UID', async () => {
    setStudyParam('1.2.840.10008.1.1');
    const { getStudyInstance } = await loadConfig();

    expect(getStudyInstance()).toBe('1.2.840.10008.1.1');
  });

  it.each([
    ['a path traversal attempt', '../../evil'],
    ['a component that is not numeric', '1..2'],
    ['a leading dot', '.1.2'],
    ['a trailing dot', '1.2.'],
    ['letters', 'abc'],
    ['an empty value', ''],
    ['a value longer than sixty-four characters', '1'.repeat(65)],
  ])('falls back to the configured study when the parameter is %s', async (_label, value) => {
    setStudyParam(value);
    const { getStudyInstance, FALLBACK_STUDY_INSTANCE_UID } = await loadConfig();

    expect(getStudyInstance()).toBe(FALLBACK_STUDY_INSTANCE_UID);
  });

  it('logs exactly one warning for a rejected parameter no matter how many times it is read', async () => {
    setStudyParam('abc');
    const { getStudyInstance } = await loadConfig();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());

    const first = getStudyInstance();
    const second = getStudyInstance();
    const third = getStudyInstance();

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});

describe('viewerUrl', () => {
  it('is the viewer origin, the viewer path and the encoded valid study parameter', async () => {
    setStudyParam('1.2.840.10008.1.1');
    const { viewerUrl } = await loadConfig();

    expect(viewerUrl()).toBe(`${VIEWER_URL_PREFIX}${encodeURIComponent('1.2.840.10008.1.1')}`);
  });

  it('is the fallback URL when the parameter is rejected', async () => {
    setStudyParam('abc');
    const { viewerUrl, FALLBACK_STUDY_INSTANCE_UID } = await loadConfig();

    expect(viewerUrl()).toBe(
      `${VIEWER_URL_PREFIX}${encodeURIComponent(FALLBACK_STUDY_INSTANCE_UID)}`,
    );
  });

  it('never lets a rejected value that looks like a second query parameter appear unescaped', async () => {
    setStudyParam('1.2&StudyInstanceUIDs=hijacked');
    const { viewerUrl, FALLBACK_STUDY_INSTANCE_UID } = await loadConfig();

    const url = viewerUrl();

    expect(url).toBe(`${VIEWER_URL_PREFIX}${encodeURIComponent(FALLBACK_STUDY_INSTANCE_UID)}`);
    expect(url).not.toContain('&StudyInstanceUIDs=hijacked');
    expect(url.match(/StudyInstanceUIDs=/g)).toHaveLength(1);
  });
});
