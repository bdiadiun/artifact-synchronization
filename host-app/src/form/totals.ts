// Pure sum logic for the form footer (canon C-4.3.8, Q-6, decision A-11). Only `done` rows with
// a value for the requested metric count; rows are grouped by unit and each group summed
// separately. mm² and px² are never added together — px² only appears when a DICOM has no pixel
// spacing, so a combined number would silently mix incompatible measurements (Q-6). Rounding for
// display happens in `format.ts`, not here, so the raw sums stay exact for any later consumer.

import type { Metrics, Unit } from '@scoring/contract';
import { RowStatus, type Row } from './rows';

export interface Total {
  unit: Unit;
  value: number;
  count: number;
}

// mm2 is shown first (the clinically meaningful unit when spacing is present), then px2, then
// any other unit alphabetically. This mirrors how the footer should read, not just how the data
// happens to arrive.
const UNIT_ORDER: readonly Unit[] = ['mm2', 'px2'];

const compareUnits = (a: Unit, b: Unit): number => {
  const rankA = UNIT_ORDER.indexOf(a);
  const rankB = UNIT_ORDER.indexOf(b);
  if (rankA !== -1 || rankB !== -1) {
    // Unranked units sort after ranked ones.
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
    // `Metrics` is typed as `Record<string, Metric>`, so TS treats every key as present; at
    // runtime a row only ever carries the metric keys the viewer actually sent (in practice just
    // `area`), so the lookup is cast to `Partial` to keep this defensive check honest.
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
