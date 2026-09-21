import type { CSSProperties } from 'react';
import type { Row } from '@app/form/rows';
import { t } from '@app/i18n';

export interface MeasurementRowProps {
  row: Row;
  index: number;
  onActivate: (rowId: string) => void;
  onCancel: (rowId: string) => void;
  onRemove: (rowId: string) => void;
  onFocus: (rowId: string) => void;
}

// The attributes that turn the row div into a button, or nothing at all (S-5.3: only a `done` row
// has an annotation to focus).
export interface RowInteraction {
  role?: 'button';
  tabIndex?: number;
  'aria-label'?: string;
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
  // A-14: stands out from the grey status text so a failed restore is not missed.
  restoreFailed: { color: '#b00020', fontSize: '12px' },
} satisfies Record<string, CSSProperties>;

export const rowStyle = (focusable: boolean): CSSProperties =>
  focusable ? { ...styles.row, ...styles.rowClickable } : styles.row;

export const rowInteraction = (focusable: boolean): RowInteraction =>
  focusable ? { role: 'button', tabIndex: 0, 'aria-label': t.focusRow } : {};
