---
description: Run the full verification set the CI runs, in the same order
---

Run these from the repository root, in order, and stop at the first failure:

```
npm run format:check
npm run lint
npm run lint:fork
npm run typecheck
npm run test
npm run build --workspace host-app
npm run check:graph
npm run graph:build && npm run docs:build && git status --short
```

Report one line per step with its result, the test count, and whether the last step left the
working tree unchanged (the generators must be idempotent). Do not fix anything unless asked.
