import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import { RowStatus } from '../form/rows';
import { t } from '../i18n';
import {
  formatRestoreFailureReason,
  formatRowKind,
  formatRowMetric,
  formatRowStatus,
} from '../utils/format';
import { rowInteraction, rowStyle, styles, type MeasurementRowProps } from './MeasurementRow.props';

// stopPropagation keeps a button click from also triggering the row's focus click. Module scope:
// the row id and the action are its only inputs, so no component closure is needed.
const createRowActionHandler =
  (rowId: string, action: (rowId: string) => void) =>
  (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    action(rowId);
  };

// Native elements, minimal grey styling (X-3: no design work required).
export const MeasurementRow = ({
  row,
  index,
  onActivate,
  onCancel,
  onRemove,
  onFocus,
}: MeasurementRowProps): JSX.Element => {
  const metricLabel = formatRowMetric(row);
  const focusable = row.status === RowStatus.Done;

  const handleActivate = createRowActionHandler(row.rowId, onActivate);
  const handleCancel = createRowActionHandler(row.rowId, onCancel);
  const handleRemove = createRowActionHandler(row.rowId, onRemove);

  // S-5.3: both are attached only while the row is focusable, so neither re-checks the status.
  const handleRowClick = (): void => {
    onFocus(row.rowId);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onFocus(row.rowId);
    }
  };

  return (
    <div
      style={rowStyle(focusable)}
      title={row.measurementUid ?? undefined}
      {...rowInteraction(focusable)}
      onClick={focusable ? handleRowClick : undefined}
      onKeyDown={focusable ? handleRowKeyDown : undefined}
    >
      <span>{`${t.rowNumberPrefix}${String(index + 1)}`}</span>
      <span style={styles.status}>{formatRowKind(row)}</span>
      <span style={styles.status}>{formatRowStatus(row.status)}</span>
      {metricLabel !== null && <span>{metricLabel}</span>}
      {row.restoreFailureReason !== null && (
        <span
          style={styles.restoreFailed}
          title={formatRestoreFailureReason(row.restoreFailureReason)}
        >
          {t.restoreFailed}
        </span>
      )}
      {row.status === RowStatus.Pending && (
        <button type="button" onClick={handleActivate}>
          {t.activate}
        </button>
      )}
      {row.status === RowStatus.Drawing && (
        <button type="button" onClick={handleCancel}>
          {t.cancel}
        </button>
      )}
      {/* S-5.2: available for every status; useScoringForm.remove decides what to send. */}
      <button type="button" onClick={handleRemove}>
        {t.remove}
      </button>
      {focusable && <span style={styles.focusHint}>{t.focusHint}</span>}
    </div>
  );
};
