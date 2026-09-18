import { useMemo, type JSX } from 'react';
import { DEFAULT_TOOL, LENGTH_TOOL } from '../config';
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
  // (C-4.3.8: "recalculated automatically"). Area and length are summed separately (S-5.4) and
  // never mixed: each metric gets its own TotalsFooter below.
  const areaTotals = useMemo(() => computeTotals(rows, 'area'), [rows]);
  const lengthTotals = useMemo(() => computeTotals(rows, 'length'), [rows]);

  const handleAddAreaRow = (): void => {
    addRow(DEFAULT_TOOL);
  };
  const handleAddLengthRow = (): void => {
    addRow(LENGTH_TOOL);
  };

  return (
    <div style={styles.panel}>
      <h1 style={styles.title}>{UI.appTitle}</h1>
      <button type="button" onClick={handleAddAreaRow}>
        {UI.addMeasurement}
      </button>
      <button type="button" onClick={handleAddLengthRow}>
        {UI.addLength}
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
        <TotalsFooter totals={areaTotals} label={UI.total} primaryUnit="mm2" />
        <TotalsFooter totals={lengthTotals} label={UI.totalLength} primaryUnit="mm" />
      </div>
    </div>
  );
};
