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

// Native elements, minimal grey styling (X-3: no design work required).
export function MeasurementRow({ row, index, onActivate, onCancel }: MeasurementRowProps) {
  const area = row.metrics?.area;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
        borderBottom: '1px solid #eee',
      }}
    >
      <span>#{index + 1}</span>
      <span style={{ color: '#666' }}>{STATUS_LABEL[row.status]}</span>
      {row.status === 'done' && area !== undefined && <span>{formatMetric(area)}</span>}
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
