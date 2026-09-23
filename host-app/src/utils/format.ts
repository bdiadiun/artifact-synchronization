import { METRIC_KEYS_BY_TOOL, type Metric, type MetricKey, type Unit } from '@bdiadiun/scoring-contract';
import { t } from '@app/i18n';
import { RowStatus, type Row } from '@app/models/row';

const UNIT_LABELS: Record<Unit, string> = {
  mm2: 'mm²',
  px2: 'px²',
  mm: 'mm',
  px: 'px',
};

const STATUS_LABELS: Record<RowStatus, string> = {
  [RowStatus.Pending]: t.statusPending,
  [RowStatus.Drawing]: t.statusDrawing,
  [RowStatus.Done]: t.statusDone,
};

const KIND_LABELS: Record<MetricKey, string> = {
  area: t.kindArea,
  length: t.kindLength,
};

export const formatMetric = (metric: Metric): string => `${metric.value.toFixed(1)} ${UNIT_LABELS[metric.unit]}`;

export const formatRowStatus = (status: RowStatus): string => STATUS_LABELS[status];

export const formatRowKind = (row: Row): string => KIND_LABELS[METRIC_KEYS_BY_TOOL[row.toolName][0]];

export const formatRowMetric = (row: Row): string | null => {
  if (row.status !== RowStatus.Done || row.metrics === null) {
    return null;
  }
  const metrics = row.metrics;
  const parts = METRIC_KEYS_BY_TOOL[row.toolName].flatMap((key) => {
    const metric = metrics[key];

    return metric === undefined ? [] : [formatMetric(metric)];
  });

  return parts.length > 0 ? parts.join(' · ') : null;
};
