---
paths:
  - packages/contract/**
---

- This is the wire contract between two separately deployed apps. It has no runtime dependency on
  anything: only its own modules. It is split by concern behind one entry, `src/index.ts`, and the
  entry is the public surface. A name that leaves the entry is a breaking change for three
  consumers, so removing or renaming one needs a decision record.
- Message `type` values are string literals, never enums, and every message carries `version: 1`.
- Adding a message type or an optional field is additive and keeps version 1; changing an existing
  shape is a breaking change and needs a decision record.
- Every message has a runtime guard, and every guard has tests, including a JSON round trip.
- A change reaches the viewer in two steps: merging into `main` publishes a patch release, then the
  fork raises its pinned version of `@bdiadiun/scoring-contract`. Never edit the contract to suit
  one side only (A-15).
