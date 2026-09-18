import type { CSSProperties } from 'react';
import type { Unit } from '@scoring/contract';
import type { Total } from '../form/totals';

export interface TotalsFooterProps {
  totals: Total[];
  // Defaults to t.total (area) so existing callers keep the same label.
  label?: string;
  // The unit shown on the primary line; any other unit in `totals` gets its own line below.
  primaryUnit?: Unit;
}

export const styles = {
  count: { color: '#666', marginLeft: '4px' },
  otherTotal: { marginTop: '4px' },
  noSpacingHint: { color: '#999', marginLeft: '4px' },
} satisfies Record<string, CSSProperties>;
