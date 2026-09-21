import type { CSSProperties } from 'react';
import type { Row } from '@app/form/rows';
import type { RowActions } from '@app/form/rowActions';

export interface ScoringPanelProps extends RowActions {
  rows: Row[];
}

export const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '16px',
    boxSizing: 'border-box',
  },
  title: { fontSize: '18px', margin: '0 0 16px' },
  emptyHint: { color: '#666' },
  rows: { marginTop: '8px' },
  footer: { marginTop: 'auto', borderTop: '1px solid #ddd', paddingTop: '8px' },
} satisfies Record<string, CSSProperties>;
