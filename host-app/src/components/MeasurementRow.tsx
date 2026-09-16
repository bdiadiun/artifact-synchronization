import type { KeyboardEvent, JSX } from 'react';
import type { Metric, Metrics } from '@scoring/contract';
import { RowStatus, type Row } from '../form/rows';
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
  [RowStatus.Pending]: UI.statusPending,
  [RowStatus.Drawing]: UI.statusDrawing,
  [RowStatus.Done]: UI.statusDone,
};

// Formats whichever metric the row has for display. `area` is the only metric the mandatory
// part produces (C-4.3.6); if it is absent but the payload carries something else (P-8 —
// perimeter, mean intensity, ...), that first metric is shown with its key so a future metric
// type does not silently disappear from the row.
const displayMetric = (metrics: Row['metrics']): string | null => {
  if (metrics === null) {
    return null;
  }
  // `Metrics` is typed as `Record<string, Metric>`, so TS treats `area` as always present; at
  // runtime it is optional (only the metrics the viewer actually sent exist), so the lookup is
  // cast to `Partial` to keep this defensive check honest.
  const area = (metrics as Partial<Metrics>).area;
  if (area !== undefined) {
    return formatMetric(area);
  }
  const firstEntry = Object.entries(metrics)[0] as [string, Metric] | undefined;
  if (firstEntry === undefined) {
    return null;
  }
  const [key, metric] = firstEntry;
  return `${key}: ${formatMetric(metric)}`;
};

// Native elements, minimal grey styling (X-3: no design work required).
export const MeasurementRow = ({
  row,
  index,
  onActivate,
  onCancel,
  onRemove,
  onFocus,
}: MeasurementRowProps): JSX.Element => {
  const metricLabel = row.status === RowStatus.Done ? displayMetric(row.metrics) : null;
  const focusable = row.status === RowStatus.Done;

  // S-5.3: only a `done` row has a matching annotation in the viewer to focus. Clicking the row
  // body (not its buttons, see stopPropagation below) sends FOCUS_MEASUREMENT; other statuses are
  // not interactive, so no role/handlers are attached to them.
  const handleRowClick = (): void => {
    if (focusable) {
      onFocus(row.rowId);
    }
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!focusable) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onFocus(row.rowId);
    }
  };

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
      {row.status === RowStatus.Done && metricLabel !== null && <span>{metricLabel}</span>}
      {row.status === RowStatus.Pending && (
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
      {row.status === RowStatus.Drawing && (
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
};
