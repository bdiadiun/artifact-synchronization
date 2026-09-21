import { describe, expect, it, vi } from 'vitest';
import { RowStatus, type Row } from '@app/form/rows';
import { loadStoredRows, saveRows } from '@app/form/storage';

const STUDY_A = '1.2.3';
const STUDY_B = '9.9.9';

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
    window.sessionStorage.setItem(
      `scoring-form:rows:${STUDY_A}`,
      JSON.stringify({ studyInstanceUid: STUDY_A, rows: [{ rowId: 'row-1' }] }),
    );

    expect(loadStoredRows(STUDY_A)).toEqual([]);
  });

  it('rejects a stored row whose geometry point has only two coordinates', () => {
    const rowWithBadGeometry = {
      ...doneRow(),
      geometry: { ...doneRow().geometry, points: [[1, 2]] },
    };
    window.sessionStorage.setItem(
      `scoring-form:rows:${STUDY_A}`,
      JSON.stringify({ studyInstanceUid: STUDY_A, rows: [rowWithBadGeometry] }),
    );

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
