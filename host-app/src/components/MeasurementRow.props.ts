import type { CSSProperties, Dispatch } from 'react';
import type { FormAction } from '@app/state/reducer';
import type { Row } from '@app/models/row';
import { t } from '@app/i18n';

export interface MeasurementRowProps {
  row: Row;
  index: number;
  dispatch: Dispatch<FormAction>;
}

interface RowInteraction {
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
  restoreFailed: { color: '#b00020', fontSize: '12px' },
} satisfies Record<string, CSSProperties>;

export const rowStyle = (focusable: boolean): CSSProperties =>
  focusable ? { ...styles.row, ...styles.rowClickable } : styles.row;

export const rowInteraction = (focusable: boolean): RowInteraction =>
  focusable ? { role: 'button', tabIndex: 0, 'aria-label': t.focusRow } : {};
