import type { KeyboardEvent } from 'react';
import type { Row, RowStatus } from '../form/rows';
import { UI } from '../ui-strings';
import { formatMetric } from '../form/format';

export interface MeasurementRowProps {
  row: Row;
  index: number;
  onActivate: (rowId: string) => void;
  onCancel: (rowId: string) => void;
  onRemove: (rowId: string) => void;
  onFocus: (rowId: string) => void;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  pending: UI.statusPending,
  drawing: UI.statusDrawing,
  done: UI.statusDone,
};

// Formats whichever metric the row has for display. `area` is the only metric the mandatory
// part produces (C-4.3.6); if it is absent but the payload carries something else (P-8 —
// perimeter, mean intensity, ...), that first metric is shown with its key so a future metric
// type does not silently disappear from the row.
function displayMetric(metrics: Row['metrics']): string | null {
  if (metrics === null) {
    return null;
  }
  if (metrics.area !== undefined) {
    return formatMetric(metrics.area);
  }
  const firstEntry = Object.entries(metrics)[0];
  if (firstEntry === undefined) {
    return null;
  }
  const [key, metric] = firstEntry;
  return `${key}: ${formatMetric(metric)}`;
}

// Native elements, minimal grey styling (X-3: no design work required).
export function MeasurementRow({ row, index, onActivate, onCancel, onRemove, onFocus }: MeasurementRowProps) {
  const metricLabel = row.status === 'done' ? displayMetric(row.metrics) : null;
  const focusable = row.status === 'done';

  // S-5.3: only a `done` row has a matching annotation in the viewer to focus. Clicking the row
  // body (not its buttons, see stopPropagation below) sends FOCUS_MEASUREMENT; other statuses are
  // not interactive, so no role/handlers are attached to them.
  function handleRowClick(): void {
    if (focusable) {
      onFocus(row.rowId);
    }
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!focusable) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onFocus(row.rowId);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
        borderBottom: '1px solid #eee',
        cursor: focusable ? 'pointer' : undefined,
      }}
      title={row.measurementUid ?? undefined}
      role={focusable ? 'button' : undefined}
      tabIndex={focusable ? 0 : undefined}
      aria-label={focusable ? UI.focusRow : undefined}
      onClick={focusable ? handleRowClick : undefined}
      onKeyDown={focusable ? handleRowKeyDown : undefined}
    >
      <span>#{index + 1}</span>
      <span style={{ color: '#666' }}>{STATUS_LABEL[row.status]}</span>
      {row.status === 'done' && metricLabel !== null && <span>{metricLabel}</span>}
      {row.status === 'pending' && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onActivate(row.rowId);
          }}
        >
          {UI.activate}
        </button>
      )}
      {row.status === 'drawing' && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCancel(row.rowId);
          }}
        >
          {UI.cancel}
        </button>
      )}
      {/* S-5.2: available for every status; useScoringForm.remove decides what, if anything, to
          send to the viewer before dropping the row. stopPropagation keeps this from also
          triggering the row's own focus click above. */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(row.rowId);
        }}
      >
        {UI.remove}
      </button>
      {focusable && <span style={{ color: '#999', fontSize: '12px' }}>{UI.focusHint}</span>}
    </div>
  );
}
