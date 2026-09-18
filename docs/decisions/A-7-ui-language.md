# A-7 — Form UI strings are Ukrainian, code stays English

Status: approved 2026-09-16. Canon: C-4.3.1–C-4.3.8, X-3.

## Context

The assignment and its diagram show Ukrainian labels ("Додати вимірювання", "Активувати",
"Очікує / Малювання… / Готово", "Разом"). Repository rules require English code and docs.

## Decision

All user-visible strings live in `host-app/src/i18n.ts` in Ukrainian, with English
comments. Components reference keys, never literals. Everything else in the repository is English.

## Rejected alternatives

- English UI: the demo video and the screen would differ from what the reviewer expects.
- A full i18n library: out of scope (X-3), one constants file is enough.

## Consequences

- Translating or renaming a label is a one-file change.
