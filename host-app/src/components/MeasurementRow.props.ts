import type { CSSProperties } from 'react';
import type { Row } from '../form/rows';

export interface MeasurementRowProps {
  row: Row;
  index: number;
  onActivate: (rowId: string) => void;
  onCancel: (rowId: string) => void;
  onRemove: (rowId: string) => void;
  onFocus: (rowId: string) => void;
}

export const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    borderBottom: '1px solid #eee',
  },
  rowClickable: { cursor: 'pointer' },
  status: { color: '#666' },
  focusHint: { color: '#999', fontSize: '12px' },
} satisfies Record<string, CSSProperties>;

export const rowStyle = (focusable: boolean): CSSProperties =>
  focusable ? { ...styles.row, ...styles.rowClickable } : styles.row;
