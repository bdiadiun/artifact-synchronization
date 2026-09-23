# A-40 — a tool yields a list of metrics; two flat tables read them

Status: approved 2026-09-24. Canon: C-4.3.5, Q-6, S-5.4. Related: [A-11](A-11-units-and-metrics-payload.md),
[A-28](A-28-boundaries-as-schemas.md).

## Context

The contract mapped every tool to one metric key (`METRIC_KEY_BY_TOOL`: `EllipticalROI → 'area'`,
`Length → 'length'`), and the extension read that one key through a nested spec — a unit table per
metric (`AREA_UNITS`, `LENGTH_UNITS`) inside a `METRIC_SPECS` record, with four helpers between
the spec and the result. Rehearsing the defence question "add mean intensity through the chain"
showed two things: an OHIF measurement carries several statistics for one shape (`area` and
`mean` for the same ellipse), so one key per tool is the wrong shape for the map; and the four
tables and four helpers were more than the job — the whole mapping is "where the unit of each
metric lives in `cachedStats`" and "how cornerstone spells a unit".

## Decision

- **`METRIC_KEYS_BY_TOOL`** in the contract's vocabulary is `Record<ToolName, readonly MetricKey[]>`:
  the metrics a tool yields, in the order they are shown. Today every list has one entry
  (`['area']`, `['area']`, `['length']`); the shape is what changes, not the content.
- **The first key is the row's own metric.** The form labels the row by it (`formatRowKind`) and
  the totals are asked for by key (`computeTotals(rows, 'area')`), so a later second metric is
  shown on the row but never enters a total by accident. The row cell lists every metric of the
  tool that arrived, in list order, joined by `·`; the former fallback ("the first metric under
  any key") is gone, since a metric outside the tool's list cannot be produced.
- **Two flat tables in the extension** (`ohif/metrics.ts`): `UNITS` — cornerstone's spellings to the
  contract's `Unit` (`'mm²'`, `'mm² ERMF'`, `'pixels²'` → `'mm2'` / `'px2'`; `'mm'`, `'pixels'` →
  `'mm'` / `'px'`), one table for every metric because a spelling names one unit whatever the
  metric; `UNIT_FIELD: Record<MetricKey, string>` — the `cachedStats` field that holds the unit of
  each metric (`areaUnit`, `unit`), typed so the compiler demands an entry for every metric key.
  `statsOf` picks the entry for the referenced image or the first one; `readMetric` reads the
  value and the unit of one key; `toMetrics` walks the tool's list and keeps what was found.
- **A new metric is a table row, not code**: a key in `MetricKey`, an entry in the tool's list,
  a field name in `UNIT_FIELD` (and a spelling in `UNITS` if the unit is new); `toMetrics` and the
  form do not change. That is the answer to DEFENCE P-8.
- Released as contract 0.1.0 (an export was renamed), channel 0.0.10, scoring-viewer 0.1.2,
  ohif-extension-loader 0.1.2; the fork follows with its entry (A-20).

## Why this way

The list is the honest shape of the data: cornerstone computes several statistics per shape and
the contract's `Metrics` has always been a partial record over the keys. Keeping the "own"
metric as the first entry avoids a second map for labels and totals. Rejected: a separate map
of "extra" keys beside the single-key map (two maps for one fact); reading every spec for every
tool (the tool's list already says what to expect, and a `Length` has no `area` to find); one
unit table per metric (guards against a spelling cornerstone never writes). The narrower
`statsOf` — the referenced image's entry or the first — replaces a search for "an entry with a
finite value for this key"; in this viewer there is one render target per measurement, and the
end-to-end scenario (draw, drag, delete, focus, restore) passes unchanged.
