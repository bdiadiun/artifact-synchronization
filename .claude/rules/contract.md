---
paths:
  - packages/contract/**
---

- This is the wire contract between two separately deployed apps. Its only runtime dependency is
  `zod` (A-26): every message is a schema, every type is `z.infer` of it, every guard is
  `safeParse`. It is split by concern behind one entry, `src/index.ts`, and the entry is the public
  surface. A name that leaves the entry is a breaking change for three
  consumers, so removing or renaming one needs a decision record.
- Message `type` values are string literals, never enums; `version: 1` is added and checked by the
  channel (A-25), the schemas never mention it.
- Adding a message type or an optional field is additive and keeps version 1; changing an existing
  shape is a breaking change and needs a decision record.
- Every message schema has tests: a JSON round trip passes, a message with a missing or wrong field
  is refused.
- A change reaches the viewer in two steps: merging into `main` publishes a patch release, then the
  fork raises its pinned version of `@bdiadiun/scoring-contract`. Never edit the contract to suit
  one side only (A-15).
