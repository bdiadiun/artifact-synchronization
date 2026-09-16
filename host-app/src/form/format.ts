// Human-readable rendering of a wire `Metric` (canon C-4.3.6, Q-6). The wire spelling (`mm2`,
// `px2`) is normalised here to the display glyphs (`mm²`, `px²`); nothing upstream should format
// units itself, so this stays the one place that changes if display formatting changes.

import type { Metric, Unit } from '@scoring/contract';

const UNIT_LABELS: Record<Unit, string> = {
  mm2: 'mm²',
  px2: 'px²',
  mm: 'mm',
  px: 'px',
};

export function formatMetric(metric: Metric): string {
  return `${metric.value.toFixed(1)} ${UNIT_LABELS[metric.unit]}`;
}
