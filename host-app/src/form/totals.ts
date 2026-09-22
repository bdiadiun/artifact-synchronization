// Per-unit sums for the form footer (A-11). mm² and px² are never added together.

import type { MetricKey, Unit } from '@bdiadiun/scoring-contract';
import { RowStatus, type Row } from './rows';

export interface Total {
  unit: Unit;
  value: number;
  count: number;
}

// mm2 first: clinically meaningful when the study carries pixel spacing.
const UNIT_ORDER: readonly Unit[] = ['mm2', 'px2', 'mm', 'px'];

const compareUnits = (a: Unit, b: Unit): number => UNIT_ORDER.indexOf(a) - UNIT_ORDER.indexOf(b);

export const computeTotals = (rows: readonly Row[], metric: MetricKey): Total[] => {
  const groups = new Map<Unit, { value: number; count: number }>();

  for (const row of rows) {
    if (row.status !== RowStatus.Done || row.metrics === null) {
      continue;
    }
    const entry = row.metrics[metric];
    if (entry === undefined) {
      continue;
    }
    const group = groups.get(entry.unit) ?? { value: 0, count: 0 };
    group.value += entry.value;
    group.count += 1;
    groups.set(entry.unit, group);
  }

  return Array.from(groups.entries())
    .map(([unit, { value, count }]) => ({ unit, value, count }))
    .sort((a, b) => compareUnits(a.unit, b.unit));
};
