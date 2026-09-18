import type { CSSProperties } from 'react';
import type { ToolName } from '@scoring/contract';
import type { Row } from '../form/rows';

export interface ScoringPanelProps {
  rows: Row[];
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
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
