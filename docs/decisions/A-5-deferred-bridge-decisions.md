# A-5 — Bridge decisions are taken in the slice that implements them

Status: resolved 2026-09-16 by A-8..A-11 (grounded in docs/notes/ohif-bridge-api.md). Canon: Q-1, Q-3, Q-4, Q-6.

## Context

ID issuance (Q-3), the early-command queue (Q-1), echo-loop protection (Q-4) and mixed-unit sums
(Q-6) depend on the real `measurementService` API of the chosen OHIF version.

## Decision

Each is decided in its implementing slice, gets its own `A-n` record and a row in
`ARCHITECTURE.md` → "Decisions" in the same PR. Until then the canon marks them open.

## Consequences

- Slice 2 planning starts with an OHIF research note (`docs/notes/ohif-*.md`) that grounds these decisions.
