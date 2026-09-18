---
description: Mark a feature-graph node done after its pull request is merged
---

Close the node named in $ARGUMENTS (for example `F-27`):

1. Set its `status` to `done` in `docs/feature-graph.json`. Never edit `docs/FEATURE-GRAPH.md`.
2. Run `npm run graph:build` and `npm run docs:build`.
3. Update the current slice, the gate and the last merged pull request in `docs/STATE.md`.
4. Run `npm run check:graph` (expect 15/15) and `npm run format:check`.

Report the node, its new status and the check results. Committing is a separate, approved step.
