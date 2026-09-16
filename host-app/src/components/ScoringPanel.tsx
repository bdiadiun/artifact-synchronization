import { useMemo } from 'react';
import { UI } from '../ui-strings';
import { MeasurementRow } from './MeasurementRow';
import { TotalsFooter } from './TotalsFooter';
import { computeTotals } from '../form/totals';
import type { Row } from '../form/rows';

export interface ScoringPanelProps {
  rows: Row[];
  addRow: () => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
}

export function ScoringPanel({ rows, addRow, activate, cancel, remove }: ScoringPanelProps) {
  // Recomputed whenever `rows` changes so the footer always reflects the current row set
  // (C-4.3.8: "recalculated automatically").
  const totals = useMemo(() => computeTotals(rows), [rows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '18px', margin: '0 0 16px' }}>{UI.appTitle}</h1>
      <button type="button" onClick={addRow}>
        {UI.addMeasurement}
      </button>
      {rows.length === 0 ? (
        <p style={{ color: '#666' }}>{UI.emptyHint}</p>
      ) : (
        <div style={{ marginTop: '8px' }}>
          {rows.map((row, index) => (
            <MeasurementRow
              key={row.rowId}
              row={row}
              index={index}
              onActivate={activate}
              onCancel={cancel}
              onRemove={remove}
            />
          ))}
        </div>
      )}
      <div style={{ marginTop: 'auto', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
        <TotalsFooter totals={totals} />
      </div>
    </div>
  );
}
