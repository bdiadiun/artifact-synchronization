// Wire unit spelling (mm2, px2) to display glyphs (mm², px²); the one place display format lives.

import type { Metric, Unit } from '@scoring/contract';

const UNIT_LABELS: Record<Unit, string> = {
  mm2: 'mm²',
  px2: 'px²',
  mm: 'mm',
  px: 'px',
};

export const formatMetric = (metric: Metric): string =>
  `${metric.value.toFixed(1)} ${UNIT_LABELS[metric.unit]}`;
