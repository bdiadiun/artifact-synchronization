// A-19: the study read from the page URL is the same one the storage key is derived from, so rows
// saved for one study must not surface when the form is reloaded for another.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { RowStatus, type Row } from '../../form/rows';

const setStudyParam = (value: string): void => {
  const url = new URL('http://localhost:3000/');
  url.searchParams.set('study', value);
  window.history.pushState({}, '', url);
};

const doneRow = (): Row => ({
  rowId: 'row-1',
  status: RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  measurementUid: 'uid-1',
  geometry: { frameOfReferenceUid: 'for-1', referencedImageId: 'image-1', points: [[1, 2, 3]] },
  restoreFailureReason: null,
});

afterEach(() => {
  window.history.pushState({}, '', 'http://localhost:3000/');
});

describe('rows storage across studies', () => {
  it('returns rows saved for the same study on reload', async () => {
    setStudyParam('1.2.3');
    vi.resetModules();
    const { usePersistRows } = await import('../usePersistRows');
    renderHook(() => {
      usePersistRows([doneRow()]);
    });

    vi.resetModules();
    const { useRestoredRows } = await import('../useRestoredRows');
    const { result } = renderHook(() => useRestoredRows());

    expect(result.current).toEqual([doneRow()]);
  });

  it('does not return rows saved under a different study', async () => {
    setStudyParam('1.2.3');
    vi.resetModules();
    const { usePersistRows } = await import('../usePersistRows');
    renderHook(() => {
      usePersistRows([doneRow()]);
    });

    setStudyParam('9.8.7');
    vi.resetModules();
    const { useRestoredRows } = await import('../useRestoredRows');
    const { result } = renderHook(() => useRestoredRows());

    expect(result.current).toEqual([]);
  });
});
