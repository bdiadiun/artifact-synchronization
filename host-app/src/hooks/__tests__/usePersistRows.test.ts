// A-14: every rows change is written back, including ones no user action caused.

import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { RowStatus, type Row } from '@app/form/rows';
import { loadStoredRows } from '@app/form/storage';
import { usePersistRows } from '@app/hooks/usePersistRows';

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

describe('usePersistRows', () => {
  it('writes the given rows to sessionStorage for the configured study', () => {
    renderHook(
      ({ rows }: { rows: Row[] }) => {
        usePersistRows(rows);
      },
      {
        initialProps: { rows: [doneRow()] },
      },
    );

    expect(loadStoredRows(STUDY_INSTANCE_UID)).toEqual([doneRow()]);
  });

  it('overwrites the stored state when rows change on rerender', () => {
    const { rerender } = renderHook(
      ({ rows }: { rows: Row[] }) => {
        usePersistRows(rows);
      },
      {
        initialProps: { rows: [doneRow()] },
      },
    );

    rerender({ rows: [] });

    expect(loadStoredRows(STUDY_INSTANCE_UID)).toEqual([]);
  });
});
