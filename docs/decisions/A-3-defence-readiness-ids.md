# A-3 — `P-*` ID class for defence-readiness items

Status: approved 2026-09-16. Canon: section 9.

## Context
Section 9 of the assignment lists questions and live changes for the defence call. They are not
requirements, but they constrain design: a tool swap (P-7) or a new row field (P-8) must be cheap.

## Decision
Section 9 items get IDs `P-1..P-9`. Graph nodes may reference them in addition to (never instead of)
a `C/Q/D` ID.

## Rejected alternatives
- Leaving them as prose: the design implications would not be traceable to code.

## Consequences
- `docs/DEFENCE.md` (slice 6) maps every `P-n` to a file and line.
