import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import { RowStatus } from '@app/models/row';
import { t } from '@app/i18n';
import { formatRowKind, formatRowMetric, formatRowStatus } from '@app/utils/format';
import { activateRow, cancelRow, focusRow, removeRow } from '@app/state/actions';
import { rowInteraction, rowStyle, styles, type MeasurementRowProps } from './MeasurementRow.props';

// Native elements, minimal grey styling (X-3: no design work required).
export const MeasurementRow = ({ row, index, dispatch }: MeasurementRowProps): JSX.Element => {
  const metricLabel = formatRowMetric(row);
  const focusable = row.status === RowStatus.Done;

  // stopPropagation keeps a button click from also triggering the row's focus click.
  const handleActivate = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    activateRow(dispatch, row);
  };

  const handleCancel = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    cancelRow(dispatch, row);
  };

  const handleRemove = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    removeRow(dispatch, row);
  };

  // S-5.3: both are attached only while the row is focusable, so neither re-checks the status.
  const handleRowClick = (): void => {
    focusRow(dispatch, row);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      focusRow(dispatch, row);
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
        <span style={styles.restoreFailed} title={t.restoreFailureReason[row.restoreFailureReason]}>
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
      {/* S-5.2: available for every status; removeRow decides what to send. */}
      <button type="button" onClick={handleRemove}>
        {t.remove}
      </button>
      {focusable && <span style={styles.focusHint}>{t.focusHint}</span>}
    </div>
  );
};
