// Renders the sum of one metric's rows (canon C-4.3.8, Q-6, decision A-11), grouped strictly by
// unit: the primary unit (mm² for area, mm for length) gets the labelled top line, any other unit
// (in practice px²/px — images without pixel spacing) gets its own line with a hint explaining why
// it is not folded into the primary sum, instead of being silently dropped or added in. ScoringPanel
// renders one instance per metric (S-5.4), so units of different metrics are never mixed together.

import type { JSX } from 'react';
import { formatMetric } from '../utils/format';
import { t } from '../i18n';
import { styles, type TotalsFooterProps } from './TotalsFooter.props';

export const TotalsFooter = ({
  totals,
  label = t.total,
  primaryUnit = 'mm2',
}: TotalsFooterProps): JSX.Element => {
  if (totals.length === 0) {
    return <div>{label}: —</div>;
  }

  const primary = totals.find((total) => total.unit === primaryUnit);
  const others = totals.filter((total) => total.unit !== primaryUnit);

  return (
    <div>
      <div>
        {label}:{' '}
        {primary !== undefined ? formatMetric({ value: primary.value, unit: primaryUnit }) : '—'}
        {primary !== undefined && (
          <span style={styles.count}>({t.measurementsCount(primary.count)})</span>
        )}
      </div>
      {others.map((total) => (
        <div key={total.unit} style={styles.otherTotal}>
          {formatMetric({ value: total.value, unit: total.unit })}
          <span style={styles.count}>({t.measurementsCount(total.count)})</span>
          {total.unit.startsWith('px') && (
            <span style={styles.noSpacingHint}>({t.totalNoSpacingHint})</span>
          )}
        </div>
      ))}
    </div>
  );
};
