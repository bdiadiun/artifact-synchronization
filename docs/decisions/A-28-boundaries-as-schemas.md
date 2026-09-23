# A-28 — a foreign object is checked by a schema, and an API without a caller does not exist

Status: approved 2026-09-22. Canon: Q-7, A-13, D-2. Related: [A-24](A-24-plain-code.md),
[A-26](A-26-zod-contract.md), [A-20](A-20-three-layers.md).

## Context

After A-26 the wire contract was one set of schemas, but the same idea was still written by hand at
the two other boundaries: OHIF's measurement object entered the extension through seven small
`typeof` helpers, and the form's `Row` was declared as an interface and then again as a schema for
`sessionStorage`. The audit that found those also found API written for callers that never came:
`channel.on()`, the viewer channel's `getState` / `subscribe`, a disposer set exported for one file,
a `hostOrigin` option threaded through two packages that the fork never passes, and eight
"service unavailable" branches for OHIF services that exist before any extension runs.

## Decision

- **Every foreign object is checked by one schema where it enters**: the wire by the contract's
  schemas, OHIF's measurement by `OhifMeasurement` in the extension, stored rows by `Row` in the
  form. No hand-written `typeof` / `Array.isArray` chains beside a schema.
- **A shape is declared once and derived from**: `StoredRow` is `Row.omit(...)`; `MetricKey` is a
  `z.enum` and `Metrics` a `partialRecord` over it, so the form reads a metric without a cast;
  `toMetrics` reads the tool → metric keys list (A-40) instead of repeating it in a `switch`.
- **An API exists only for a caller that exists**: `on`, the viewer end's state, the disposer set
  and the `hostOrigin` option are removed. The OHIF services the bridge uses are typed as required
  (see `docs/notes/ohif-service-availability.md`); one check at start-up replaces the eight
  branches.
- **The wire changes in one point**: a metric key outside the vocabulary is now refused (it was
  accepted and shown by name). Adding a metric is one line in `vocabulary.ts`, as a unit already is.

## Why this way

The reading rule stays the same at every boundary — "find the schema" — instead of one rule for
the wire and another for the rest. Removing API nobody calls is what keeps the channel small enough
to remember; a method kept "for later" is read every time and used never.
