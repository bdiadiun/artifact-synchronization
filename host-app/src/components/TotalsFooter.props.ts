import type { CSSProperties } from 'react';
import type { Total } from '../form/totals';

export interface TotalsFooterProps {
  totals: Total[];
}

export const styles = {
  count: { color: '#666', marginLeft: '4px' },
  otherTotal: { marginTop: '4px' },
  noSpacingHint: { color: '#999', marginLeft: '4px' },
} satisfies Record<string, CSSProperties>;
