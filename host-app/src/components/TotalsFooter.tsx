// Renders the sum of row areas (canon C-4.3.8, Q-6, decision A-11). mm² is the primary line;
// any other unit (in practice px² — images without pixel spacing) gets its own line with a hint
// explaining why it is not folded into the mm² sum, instead of being silently dropped or added in.

import type { JSX } from 'react';
import type { Total } from '../form/totals';
import { formatMetric } from '../form/format';
import { UI } from '../ui-strings';

export interface TotalsFooterProps {
  totals: Total[];
}

export const TotalsFooter = ({ totals }: TotalsFooterProps): JSX.Element => {
  if (totals.length === 0) {
    return <div>{UI.total}: —</div>;
  }

  const mm2 = totals.find((total) => total.unit === 'mm2');
  const others = totals.filter((total) => total.unit !== 'mm2');

  return (
    <div>
      <div>
        {UI.total}: {mm2 !== undefined ? formatMetric({ value: mm2.value, unit: 'mm2' }) : '—'}
        {mm2 !== undefined && (
          <span style={{ color: '#666', marginLeft: '4px' }}>
            ({UI.measurementsCount(mm2.count)})
          </span>
        )}
      </div>
      {others.map((total) => (
        <div key={total.unit} style={{ marginTop: '4px' }}>
          {formatMetric({ value: total.value, unit: total.unit })}
          <span style={{ color: '#666', marginLeft: '4px' }}>
            ({UI.measurementsCount(total.count)})
          </span>
          {total.unit === 'px2' && (
            <span style={{ color: '#999', marginLeft: '4px' }}>({UI.totalNoSpacingHint})</span>
          )}
        </div>
      ))}
    </div>
  );
};
