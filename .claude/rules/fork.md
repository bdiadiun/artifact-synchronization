---
paths:
  - viewer/**
---

- `viewer/` is a local checkout of the OHIF fork (A-18); the fork has its own history and pull
  requests. No code of ours lives there any more. The fork may hold exactly three things of ours:
  the registration entry in `platform/app/pluginConfig.json`, the dependency line in
  `platform/app/package.json`, and `.github/workflows/scoring-bridge.yml`. Anything else needs a
  decision record first. Do not rework OHIF's own UI (canon X-5).
- The viewer-side code is the package `@bdiadiun/ohif-extension-scoring-bridge`, which depends on
  the contract. To take a change, publish it from the host repository first, then raise the pin
  here. The host origin the viewer accepts is not in the fork's source: it arrives through
  `window.config.scoringBridge.hostOrigin`, and the bridge refuses to start without one rather than
  accepting any page.
- There is nothing of ours to lint here. The package is linted, type-checked and tested in the host
  repository like every other package.
- Start the dev server as `OHIF_OPEN=false yarn --cwd platform/app dev`.
