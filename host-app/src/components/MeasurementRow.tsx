import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import { RowStatus } from '@app/form/rows';
import { t } from '@app/i18n';
import { formatRowKind, formatRowMetric, formatRowStatus } from '@app/form/format';
import { rowInteraction, rowStyle, styles, type MeasurementRowProps } from './MeasurementRow.props';

// stopPropagation keeps a button click from also triggering the row's focus click.
const stopAndRun = (
  event: MouseEvent<HTMLButtonElement>,
  action: (rowId: string) => void,
  rowId: string,
): void => {
  event.stopPropagation();
  action(rowId);
};

// Native elements, minimal grey styling (X-3: no design work required).
export const MeasurementRow = (props: MeasurementRowProps): JSX.Element => {
  const { row, index, onActivate, onCancel, onRemove, onFocus } = props;
  const metricLabel = formatRowMetric(row);
  const focusable = row.status === RowStatus.Done;

  const handleActivate = (event: MouseEvent<HTMLButtonElement>): void => {
    stopAndRun(event, onActivate, row.rowId);
  };

  const handleCancel = (event: MouseEvent<HTMLButtonElement>): void => {
    stopAndRun(event, onCancel, row.rowId);
  };

  const handleRemove = (event: MouseEvent<HTMLButtonElement>): void => {
    stopAndRun(event, onRemove, row.rowId);
  };

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
      {/* S-5.2: available for every status; useScoringForm.remove decides what to send. */}
      <button type="button" onClick={handleRemove}>
        {t.remove}
      </button>
      {focusable && <span style={styles.focusHint}>{t.focusHint}</span>}
    </div>
  );
};
