// Render tests for the totals footer wiring (canon C-4.3.8, Q-6). Exercises `ScoringPanel`
// end-to-end (rows -> computeTotals -> TotalsFooter) rather than mocking totals, since the wiring
// itself (recompute on every rows change) is what this slice adds.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoringPanel } from './ScoringPanel';
import type { Row } from '../form/rows';

const noop = vi.fn();

function doneRow(rowId: string, value: number, unit: 'mm2' | 'px2'): Row {
  return {
    rowId,
    status: 'done',
    toolName: 'EllipticalROI',
    metrics: { area: { value, unit } },
    measurementUid: `uid-${rowId}`,
  };
}

function pendingRow(rowId: string): Row {
  return {
    rowId,
    status: 'pending',
    toolName: 'EllipticalROI',
    metrics: null,
    measurementUid: null,
  };
}

describe('ScoringPanel totals footer', () => {
  it('shows the mm2 sum and a separate px2 line with the hint for mixed-unit done rows', () => {
    const rows: Row[] = [
      doneRow('row-1', 124.5, 'mm2'),
      doneRow('row-2', 88.2, 'mm2'),
      doneRow('row-3', 1520, 'px2'),
    ];

    render(<ScoringPanel rows={rows} addRow={noop} activate={noop} cancel={noop} remove={noop} focus={noop} />);

    expect(screen.getByText(/212\.7 mm²/)).toBeInTheDocument();
    expect(screen.getAllByText(/1520\.0 px²/).length).toBeGreaterThan(0);
    expect(screen.getByText(/без піксельного spacing/)).toBeInTheDocument();
  });

  it('shows — when only pending rows are present', () => {
    const rows: Row[] = [pendingRow('row-1')];

    render(<ScoringPanel rows={rows} addRow={noop} activate={noop} cancel={noop} remove={noop} focus={noop} />);

    expect(screen.getByText(/Разом:\s*—/)).toBeInTheDocument();
  });
});
