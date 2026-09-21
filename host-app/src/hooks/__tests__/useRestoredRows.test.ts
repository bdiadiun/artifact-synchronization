// A-14: the hook seeds its state once from sessionStorage; the parsing rules themselves are
// covered in form/__tests__/storage.test.ts.

import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { RowStatus, type Row } from '@app/form/rows';
import { saveRows } from '@app/form/storage';
import { useRestoredRows } from '@app/hooks/useRestoredRows';

const STUDY_INSTANCE_UID = '1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1';

const doneRow = (): Row => ({
  rowId: 'row-1',
  status: RowStatus.Done,
  toolName: 'EllipticalROI',
  metrics: { area: { value: 124.5, unit: 'mm2' } },
  measurementUid: 'uid-1',
  geometry: { frameOfReferenceUid: 'for-1', referencedImageId: 'image-1', points: [[1, 2, 3]] },
  restoreFailureReason: null,
});

describe('useRestoredRows', () => {
  it('returns the rows stored for the configured study', () => {
    saveRows(STUDY_INSTANCE_UID, [doneRow()]);

    const { result } = renderHook(() => useRestoredRows());

    expect(result.current).toEqual([doneRow()]);
  });

  it('returns an empty list when nothing was stored', () => {
    const { result } = renderHook(() => useRestoredRows());

    expect(result.current).toEqual([]);
  });
});
