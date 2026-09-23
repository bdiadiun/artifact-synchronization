# A-38 — the OHIF-side packages are named after their roles

Status: approved 2026-09-23. Canon: C-3.4, C-4.1, D-2. Related: [A-20](A-20-three-layers.md),
[A-32](A-32-react-bridge.md), [A-34](A-34-two-applications-one-channel-hook.md).

## Context

A-34 made the OHIF-side package an application in its own right — the form's peer, with its own
world (OHIF) and the same way of speaking to the channel — while its name still said "bridge".
The other package, which registers it through OHIF's extension manager, was called an "adapter".
The author asked for names that say what the packages are.

## Decision

- **`packages/scoring-viewer`, `@bdiadiun/ohif-extension-scoring-viewer`** — the OHIF-side
  scoring application, packaged as an OHIF extension. Inside it: `ScoringViewer.tsx`
  (`getContextModule`, the provider, `ScoringViewerContext`), `hooks/useScoringViewer.ts`,
  `session.ts` (`Session`, `createSession`: the application's data for one mount, formerly
  `Bridge`), the log prefix `[scoring-viewer]`, the extension id
  `@bdiadiun/ohif-extension-scoring-viewer`, the viewer configuration key
  `window.config.scoringViewer.hostOrigin`.
- **`packages/ohif-extension-loader`, `@bdiadiun/ohif-extension-loader`** — the one package the
  fork lists; its `preRegistration` loads our extensions through OHIF's extension manager
  (`extensionLoader`, `EXTENSION_LOADER_ID`, log prefix `[extension-loader]`).
- Both start again at `0.1.0`: a new name is a new line on the registry. The contract and the
  channel keep their names and versions.
- The notes follow: `docs/notes/viewer-internals.md` (was `bridge-internals.md`) and
  `docs/notes/ohif-api.md` (was `ohif-bridge-api.md`). Decision records before this one keep the
  word "bridge" as the name of their time; this record is the translation.
- The fork follows by one pull request after the publish: the dependency line in
  `platform/app/package.json` and the `packageName` in `pluginConfig.json` switch to the loader,
  then `viewer.json` pins the new fork commit (A-18, A-20).

## Why this way

A reader who opens `packages/` should see two applications and their contract and channel, not a
"bridge" and an "adapter" whose roles need a paragraph. Rejected: keeping the npm names and
renaming only the folders (the names the fork and the registry show would still lie); a single
package for both roles (the loader is the fork's fixed entry and must not change when the
application does, A-20).
