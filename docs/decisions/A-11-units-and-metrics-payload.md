# A-11 — Units copied from OHIF; extensible `metrics` payload; per-unit sums

Status: approved 2026-09-16. Canon: Q-6, C-4.3.8, C-4.4.2, P-8.

## Context
Area arrives in mm² when the image has pixel spacing and in px² otherwise. OHIF exposes it as
`measurement.data[targetId].area` with `areaUnit` computed by cornerstone3D.

## Decision
- The bridge copies `area` and `areaUnit` as is into `metrics: { area: { value, unit } }` with
  `unit: 'mm2' | 'px2'` (normalised spelling; the display layer renders `mm²` / `px²`).
- `metrics` is a record keyed by metric name, so a new metric (perimeter, mean intensity — P-8) is a
  new key, not a new message type.
- The total is computed per unit: rows are grouped by `unit`, each group summed separately. The
  footer shows the mm² total and, only if px² rows exist, a second line for px² with a hint that
  those images have no pixel spacing. mm² and px² are never added together.
- Unit tests cover: mixed units, empty list, rows without a value, rounding to one decimal.

## Rejected alternatives
- Flat `value` / `unit` fields: simpler, but P-8 would change the message type.
- Converting px² to mm² with a guessed spacing: fabricates clinical numbers.

## Consequences
- The sum function is pure and lives in `host-app/src/form/totals.ts`, the natural test target (X-4).
