---
paths:
  - viewer/**
---

- `viewer/` is a git submodule pointing at the OHIF fork; it has its own history and pull requests.
  Changes belong to `extensions/scoring-bridge/`. Outside it the fork may touch exactly three
  things: the registration entry in `platform/app/pluginConfig.json`, the workspace dependency line
  in `platform/app/package.json`, and `.github/workflows/scoring-bridge.yml`, which lints and builds
  the extension. Anything else outside the extension needs a decision record first. Do not rework
  OHIF's own UI (canon X-5).
- The contract comes from the published package `@bdiadiun/scoring-contract`, pinned to an exact
  version in `extensions/scoring-bridge/package.json`. There is no copy of it in the fork any more.
  To take a contract change, publish it from the host repository first, then raise the pin here.
- Style is checked with `npm run lint:fork` from the host repository, because OHIF's own ESLint does
  not run at this version.
- Start the dev server as `OHIF_OPEN=false yarn --cwd platform/app dev`.
