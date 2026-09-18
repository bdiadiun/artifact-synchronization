---
paths:
  - viewer/**
---

- `viewer/` is a git submodule pointing at the OHIF fork; it has its own history and pull requests.
  Changes belong to `extensions/scoring-bridge/` plus the single registration line in
  `platform/app/pluginConfig.json`. Do not rework OHIF's own UI (canon X-5).
- `extensions/scoring-bridge/src/contract/messages.ts` is a byte-identical copy of
  `packages/contract/src/messages.ts`: never edit it here, run `npm run contract:sync` in the host
  repository instead, and keep `messages.sha256` next to it.
- Style is checked with `npm run lint:fork` from the host repository, because OHIF's own ESLint does
  not run at this version.
- Start the dev server as `OHIF_OPEN=false yarn --cwd platform/app dev`.
