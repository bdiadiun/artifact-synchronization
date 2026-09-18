// Display format for a row: wire unit spelling (mm2, px2) to glyphs (mm², px²), and the labels a
// row shows. The one place display strings for a measurement are built.

import type { Metric, Metrics, RestoreFailureReason, Unit } from '@scoring/contract';
import { t } from '../i18n';
import { RowStatus, metricKeyForTool, type MetricKey, type Row } from '../form/rows';

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

export const formatMetric = (metric: Metric): string =>
  `${metric.value.toFixed(1)} ${UNIT_LABELS[metric.unit]}`;

export const formatRowStatus = (status: RowStatus): string => STATUS_LABELS[status];

// A-14: tooltip text for the restoreFailed marker; t.restoreFailureReason is the single lookup.
export const formatRestoreFailureReason = (reason: RestoreFailureReason): string =>
  t.restoreFailureReason[reason];

export const formatRowKind = (row: Row): string => KIND_LABELS[metricKeyForTool(row.toolName)];

// Formats the metric that matches the row's own tool (S-5.4: area for the ellipse/rectangle
// tools, length for the length tool). If that key is absent but the payload carries something
// else (P-8 — perimeter, mean intensity, ...), that first metric is shown with its key so a
// future metric type does not silently disappear from the row.
export const formatRowMetric = (row: Row): string | null => {
  if (row.status !== RowStatus.Done || row.metrics === null) {
    return null;
  }
  // `Metrics` is typed as `Record<string, Metric>`, so TS treats every key as always present; at
  // runtime it is optional (only the metrics the viewer actually sent exist), so the lookup is
  // cast to `Partial` to keep this defensive check honest.
  const own = (row.metrics as Partial<Metrics>)[metricKeyForTool(row.toolName)];
  if (own !== undefined) {
    return formatMetric(own);
  }
  const firstEntry = Object.entries(row.metrics)[0] as [string, Metric] | undefined;
  if (firstEntry === undefined) {
    return null;
  }
  const [key, metric] = firstEntry;
  return `${key}: ${formatMetric(metric)}`;
};
