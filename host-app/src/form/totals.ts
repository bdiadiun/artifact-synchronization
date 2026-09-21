// Per-unit sums for the form footer (A-11). mm² and px² are never added together.

import type { Metrics, Unit } from '@bdiadiun/scoring-contract';
import { RowStatus, type Row } from './rows';

export interface Total {
  unit: Unit;
  value: number;
  count: number;
}

// mm2 first (clinically meaningful when spacing is present), then px2, then anything else alphabetically.
const UNIT_ORDER: readonly Unit[] = ['mm2', 'px2'];

const compareUnits = (a: Unit, b: Unit): number => {
  const rankA = UNIT_ORDER.indexOf(a);
  const rankB = UNIT_ORDER.indexOf(b);
  if (rankA !== -1 || rankB !== -1) {
    return (rankA === -1 ? UNIT_ORDER.length : rankA) - (rankB === -1 ? UNIT_ORDER.length : rankB);
  }
  return a.localeCompare(b);
};

export const computeTotals = (rows: readonly Row[], metric: keyof Metrics = 'area'): Total[] => {
  const groups = new Map<Unit, { value: number; count: number }>();

  for (const row of rows) {
    if (row.status !== RowStatus.Done || row.metrics === null) {
      continue;
    }
    // Cast to Partial: `Metrics` types every key as present, but a row only carries what the
    // viewer actually sent.
    const entry = (row.metrics as Partial<Metrics>)[metric];
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
