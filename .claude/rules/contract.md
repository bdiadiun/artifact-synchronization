---
paths:
  - packages/contract/**
---

- This is the wire contract between two separately deployed apps. It stays one self-contained file
  with no imports and no runtime dependencies, because the fork copies it verbatim.
- Message `type` values are string literals, never enums, and every message carries `version: 1`.
- Adding a message type or an optional field is additive and keeps version 1; changing an existing
  shape is a breaking change and needs a decision record.
- Every message has a runtime guard, and every guard has tests, including a JSON round trip.
- After any change run `npm run contract:sync`, then `npm run check:contract` (three ok lines).
