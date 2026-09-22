import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { FALLBACK_STUDY_INSTANCE_UID } from '@app/config';
import { RowStatus, type Row } from '@app/form/rows';
import { loadStoredRows, saveRows, usePersistRows, useRestoredRows } from '@app/form/storage';

const STUDY_A = '1.2.3';
const STUDY_B = '9.9.9';
const CONFIGURED_STUDY = FALLBACK_STUDY_INSTANCE_UID;

const doneRow = (overrides: Partial<Row> = {}): Row => ({
  rowId: 'row-1',
  status: RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  measurementUid: 'uid-1',
  geometry: {
    frameOfReferenceUid: 'for-1',
    referencedImageId: 'image-1',
    points: [[1, 2, 3]],
  },
  restoreFailureReason: null,
  ...overrides,
});

const storeRows = (studyInstanceUid: string, rows: unknown[]): void => {
  window.sessionStorage.setItem(
    `scoring-form:rows:${studyInstanceUid}`,
    JSON.stringify({ studyInstanceUid, rows }),
  );
};

describe('saveRows / loadStoredRows', () => {
  it('round-trips rows saved for the same study', () => {
    saveRows(STUDY_A, [doneRow()]);

    const loaded = loadStoredRows(STUDY_A);

    expect(loaded).toEqual([doneRow()]);
  });

  it('drops restoreFailureReason: a fresh load always starts unmarked', () => {
    saveRows(STUDY_A, [doneRow({ restoreFailureReason: 'viewer-error' })]);

    const loaded = loadStoredRows(STUDY_A);

    expect(loaded[0].restoreFailureReason).toBeNull();
  });

  it('ignores state saved for a different study', () => {
    saveRows(STUDY_A, [doneRow()]);

    expect(loadStoredRows(STUDY_B)).toEqual([]);
  });

  it('returns an empty list when nothing was ever saved', () => {
    expect(loadStoredRows(STUDY_A)).toEqual([]);
  });

  it('ignores malformed JSON in the storage slot', () => {
    window.sessionStorage.setItem(`scoring-form:rows:${STUDY_A}`, '{not json');

    expect(loadStoredRows(STUDY_A)).toEqual([]);
  });

  it('ignores a validly-parsed value that does not match the stored shape', () => {
    storeRows(STUDY_A, [{ rowId: 'row-1' }]);

    expect(loadStoredRows(STUDY_A)).toEqual([]);
  });

  it('drops a key the stored row does not declare', () => {
    storeRows(STUDY_A, [{ ...doneRow(), leftoverFromAnOlderVersion: 'gone' }]);

    const loaded = loadStoredRows(STUDY_A);

    expect(loaded).toEqual([doneRow()]);
    expect(loaded[0]).not.toHaveProperty('leftoverFromAnOlderVersion');
  });

  it('restores nothing when one stored row carries an unknown status', () => {
    storeRows(STUDY_A, [doneRow(), { ...doneRow(), rowId: 'row-2', status: 'half-done' }]);

    expect(loadStoredRows(STUDY_A)).toEqual([]);
  });

  it('rejects a stored row whose geometry point has only two coordinates', () => {
    storeRows(STUDY_A, [{ ...doneRow(), geometry: { ...doneRow().geometry, points: [[1, 2]] } }]);

    expect(loadStoredRows(STUDY_A)).toEqual([]);
  });

  it('renders normally (returns []) when sessionStorage throws on read', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(loadStoredRows(STUDY_A)).toEqual([]);

    getItemSpy.mockRestore();
  });

  it('does not throw when sessionStorage throws on write', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => {
      saveRows(STUDY_A, [doneRow()]);
    }).not.toThrow();

    setItemSpy.mockRestore();
  });
});

describe('useRestoredRows', () => {
  it('returns the rows stored for the configured study', () => {
    saveRows(CONFIGURED_STUDY, [doneRow()]);

    const { result } = renderHook(() => useRestoredRows());

    expect(result.current).toEqual([doneRow()]);
  });

  it('returns an empty list when nothing was stored', () => {
    const { result } = renderHook(() => useRestoredRows());

    expect(result.current).toEqual([]);
  });
});

describe('usePersistRows', () => {
  it('writes the given rows to sessionStorage for the configured study', () => {
    renderHook(
      ({ rows }: { rows: Row[] }) => {
        usePersistRows(rows);
      },
      { initialProps: { rows: [doneRow()] } },
    );

    expect(loadStoredRows(CONFIGURED_STUDY)).toEqual([doneRow()]);
  });

  it('overwrites the stored state when rows change on rerender', () => {
    const { rerender } = renderHook(
      ({ rows }: { rows: Row[] }) => {
        usePersistRows(rows);
      },
      { initialProps: { rows: [doneRow()] } },
    );

    rerender({ rows: [] });

    expect(loadStoredRows(CONFIGURED_STUDY)).toEqual([]);
  });
});
