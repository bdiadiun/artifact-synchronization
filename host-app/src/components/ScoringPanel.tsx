import { useMemo, type JSX } from 'react';
import { DEFAULT_TOOL, getStudyInstance, LENGTH_TOOL } from '@app/config';
import { t } from '@app/i18n';
import { addRow } from '@app/state/actions';
import { computeTotals } from '@app/utils/totals';
import { useChannel } from '@app/hooks/useChannel';
import { useScoringForm } from '@app/hooks/useScoringForm';
import { BridgeStatus } from './BridgeStatus';
import { MeasurementRow } from './MeasurementRow';
import { TotalsFooter } from './TotalsFooter';
import { styles } from './ScoringPanel.props';

export const ScoringPanel = (): JSX.Element => {
  const [rows, dispatch] = useScoringForm(getStudyInstance());
  const channelState = useChannel();
  const areaTotals = useMemo(() => computeTotals(rows, 'area'), [rows]);
  const lengthTotals = useMemo(() => computeTotals(rows, 'length'), [rows]);

  const handleAddAreaRow = (): void => {
    addRow(dispatch, DEFAULT_TOOL);
  };
  const handleAddLengthRow = (): void => {
    addRow(dispatch, LENGTH_TOOL);
  };

  return (
    <div style={styles.panel}>
      <BridgeStatus state={channelState} />
      <h1 style={styles.title}>{t.appTitle}</h1>
      <button type="button" onClick={handleAddAreaRow}>
        {t.addMeasurement}
      </button>
      <button type="button" onClick={handleAddLengthRow}>
        {t.addLength}
      </button>
      {rows.length === 0 ? (
        <p style={styles.emptyHint}>{t.emptyHint}</p>
      ) : (
        <div style={styles.rows}>
          {rows.map((row, index) => (
            <MeasurementRow key={row.rowId} row={row} index={index} dispatch={dispatch} />
          ))}
        </div>
      )}
      <div style={styles.footer}>
        <TotalsFooter totals={areaTotals} label={t.total} primaryUnit="mm2" />
        <TotalsFooter totals={lengthTotals} label={t.totalLength} primaryUnit="mm" />
      </div>
    </div>
  );
};
