import type { CSSProperties } from 'react';
import type { Unit } from '@bdiadiun/scoring-contract';
import type { Total } from '@app/utils/totals';

export interface TotalsFooterProps {
  totals: Total[];
  label: string;
  primaryUnit: Unit;
}

export const styles = {
  count: { color: '#666', marginLeft: '4px' },
  otherTotal: { marginTop: '4px' },
  noSpacingHint: { color: '#999', marginLeft: '4px' },
} satisfies Record<string, CSSProperties>;
