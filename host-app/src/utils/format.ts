import { METRIC_KEY_BY_TOOL, type Metric, type MetricKey, type Unit } from '@bdiadiun/scoring-contract';
import { t } from '@app/i18n';
import { RowStatus, type Row } from '@app/state/reducer';

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

export const formatRowKind = (row: Row): string => KIND_LABELS[METRIC_KEY_BY_TOOL[row.toolName]];

// S-5.4: shows the metric matching the row's own tool. If that key is absent, the first metric in
// the payload is shown with its key (P-8), so a metric type added later is visible instead of
// silently dropped.
export const formatRowMetric = (row: Row): string | null => {
  if (row.status !== RowStatus.Done || row.metrics === null) {
    return null;
  }
  const own = row.metrics[METRIC_KEY_BY_TOOL[row.toolName]];
  if (own !== undefined) {
    return formatMetric(own);
  }
  const firstEntry = Object.entries(row.metrics).at(0);
  if (firstEntry === undefined) {
    return null;
  }
  const [key, metric] = firstEntry;
  return `${key}: ${formatMetric(metric)}`;
};
