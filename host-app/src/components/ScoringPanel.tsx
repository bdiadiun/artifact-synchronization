import { useMemo, type JSX } from 'react';
import { UI } from '../ui-strings';
import { MeasurementRow } from './MeasurementRow';
import { TotalsFooter } from './TotalsFooter';
import { computeTotals } from '../form/totals';
import { styles, type ScoringPanelProps } from './ScoringPanel.props';

export const ScoringPanel = ({
  rows,
  addRow,
  activate,
  cancel,
  remove,
  focus,
}: ScoringPanelProps): JSX.Element => {
  // Recomputed whenever `rows` changes so the footer always reflects the current row set
  // (C-4.3.8: "recalculated automatically").
  const totals = useMemo(() => computeTotals(rows), [rows]);

  return (
    <div style={styles.panel}>
      <h1 style={styles.title}>{UI.appTitle}</h1>
      <button type="button" onClick={addRow}>
        {UI.addMeasurement}
      </button>
      {rows.length === 0 ? (
        <p style={styles.emptyHint}>{UI.emptyHint}</p>
      ) : (
        <div style={styles.rows}>
          {rows.map((row, index) => (
            <MeasurementRow
              key={row.rowId}
              row={row}
              index={index}
              onActivate={activate}
              onCancel={cancel}
              onRemove={remove}
              onFocus={focus}
            />
          ))}
        </div>
      )}
      <div style={styles.footer}>
        <TotalsFooter totals={totals} />
      </div>
    </div>
  );
};
