import type { Row, RowStatus } from '../form/rows';
import { UI } from '../ui-strings';
import { formatMetric } from '../form/format';

export interface MeasurementRowProps {
  row: Row;
  index: number;
  onActivate: (rowId: string) => void;
  onCancel: (rowId: string) => void;
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
export function MeasurementRow({ row, index, onActivate, onCancel }: MeasurementRowProps) {
  const metricLabel = row.status === 'done' ? displayMetric(row.metrics) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
        borderBottom: '1px solid #eee',
      }}
      title={row.measurementUid ?? undefined}
    >
      <span>#{index + 1}</span>
      <span style={{ color: '#666' }}>{STATUS_LABEL[row.status]}</span>
      {row.status === 'done' && metricLabel !== null && <span>{metricLabel}</span>}
      {row.status === 'pending' && (
        <button type="button" onClick={() => onActivate(row.rowId)}>
          {UI.activate}
        </button>
      )}
      {row.status === 'drawing' && (
        <button type="button" onClick={() => onCancel(row.rowId)}>
          {UI.cancel}
        </button>
      )}
    </div>
  );
}
