// A-11 / Q-6: totals are grouped strictly by unit. The primary unit takes the labelled line and
// any other unit (px²/px, an image without pixel spacing) gets its own line with a hint, rather
// than being dropped or added into a sum it does not belong to.

import type { JSX } from 'react';
import { formatMetric } from '@app/utils/format';
import { t } from '@app/i18n';
import { styles, type TotalsFooterProps } from './TotalsFooter.props';

export const TotalsFooter = ({
  totals,
  label = t.total,
  primaryUnit = 'mm2',
}: TotalsFooterProps): JSX.Element => {
  if (totals.length === 0) {
    return (
      <div>
        {label}: {t.emptyValue}
      </div>
    );
  }

  const primary = totals.find((total) => total.unit === primaryUnit);
  const others = totals.filter((total) => total.unit !== primaryUnit);

  return (
    <div>
      <div>
        {label}:{' '}
        {primary !== undefined
          ? formatMetric({ value: primary.value, unit: primaryUnit })
          : t.emptyValue}
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
