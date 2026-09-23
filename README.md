# artifact-synchronization

A micro-frontend pair: an OHIF Viewer fork with a bridge extension, and a host app with a scoring
form. They run on separate ports and talk only over `window.postMessage`.

- Requirements: [docs/CANON.md](docs/CANON.md); work breakdown: [docs/FEATURE-GRAPH.md](docs/FEATURE-GRAPH.md).
- Message contract and decisions: [ARCHITECTURE.md](ARCHITECTURE.md); AI usage: [AI-USAGE.md](AI-USAGE.md); defence notes: [docs/DEFENCE.md](docs/DEFENCE.md).
- Layout: `host-app/` (React + Vite, port 5173) and four published packages: `packages/contract/`
  (the message schemas, zod), `packages/channel/` (one `useChannel` for both sides: origin check, version,
  schema guard, `send`, `on`, and the queue until `VIEWER_READY`),
  `packages/viewer-bridge/` and `packages/viewer-adapter/` (the OHIF extension and the adapter that
  registers it); `viewer/` (a local checkout of
  [bdiadiun/Viewers](https://github.com/bdiadiun/Viewers), branch `scoring`, based on OHIF
  `v3.12.17`, port 3000; cloned on demand and not part of this repository, see A-18).

## Prerequisites

- Node.js 22 (`.nvmrc`; `nvm use` if you use nvm).
- Git. Yarn 1 is provided by corepack (bundled with Node), no global install.
- Ports 3000 (viewer) and 5173 (host app) free. Both are fixed: the apps check each other's origin.
- Time: the first run takes about 5–10 minutes (cloning the viewer, `yarn install`, first webpack
  build); later starts take seconds.

## Run from a clean machine

```sh
git clone https://github.com/bdiadiun/artifact-synchronization.git
cd artifact-synchronization
npm ci
```

### 1. Viewer (port 3000)

```sh
corepack enable
npm run viewer:setup    # clones the fork at the commit pinned in viewer.json and installs it
npm run viewer:dev
```

`viewer:setup` is needed once. It clones [bdiadiun/Viewers](https://github.com/bdiadiun/Viewers)
into `viewer/` at the exact commit recorded in `viewer.json`, so the viewer you run is the one this
repository was tested against. The folder is ignored by git and is not part of this repository.

Wait for "compiled successfully", then check http://localhost:3000/viewer?StudyInstanceUIDs=1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1
opens a study. Notes:

- `viewer:link` makes the viewer run the packages of this working tree instead of the released
  ones (symlinks into the fork's `node_modules`); `viewer:unlink` restores the installed copies.
- `viewer:dev` runs the server from `platform/app` with the browser tab suppressed. Running
  `yarn dev` at the viewer root instead does not work: that script picks up a `bun.lock` and
  requires bun.
- `yarn install` prints many `unmet peer dependency` warnings and two
  `Workspaces can only be enabled in private projects` warnings; the webpack build ends with one
  `InjectManifest ... --watch mode` warning. All of these are expected and harmless.

### 2. Host app (port 5173), in a second terminal

```sh
npm install             # installs host-app and every package (npm workspaces)
npm run dev --workspace host-app
```

Open http://localhost:5173. To work on another study, add its identifier to the form's own URL,
`http://localhost:5173/?study=<StudyInstanceUID>`; anything that is not a DICOM identifier is
refused and the default study is used (A-19). The left pane embeds the viewer; the status line in the right panel
turns to "готовий" once the viewer has sent `VIEWER_READY`.

### 3. Use it

1. "Додати вимірювання" creates a row with status "Очікує".
2. "Активувати" arms the ellipse tool in the viewer (row → "Малювання…"). "Скасувати" returns it to "Очікує".
3. Draw an ellipse on the image. The row shows the area (e.g. `124.5 mm²`), status "Готово", and the
   viewer returns to the tool that was active before. On the first ellipse OHIF asks "Track
   measurements for this series?"; either answer works.
4. "Разом" at the bottom sums the areas per unit (mm² and px² are never added together).

### 4. Bonus features

- **Live update.** Drag a handle of a drawn ellipse: the row value and the total follow while you drag.
- **Deletion in both directions.** "Видалити" on a row removes its annotation in the viewer.
  Deleting an annotation in OHIF (measurements panel → row menu → Delete) returns the row to
  "Очікує".
- **Focus.** Click a "Готово" row (or press Enter on it): the viewer jumps to that image and
  selects the annotation.
- **Version on every viewport.** Bottom-right corner of each viewport shows `OHIF 3.12.17`, injected
  at build time; switch to a 2×2 layout to see it in every pane.

## Known behaviour

- OHIF shows "Track measurements for this series?" on the first annotation; answer or ignore it,
  the measurement is delivered either way.
- The demo study's first series is a CT topogram with large pixel spacing, so areas are large but
  correct. Pick another series in the left panel for smaller numbers.
- If the viewer fails to load a study, no `VIEWER_READY` is sent and commands stay queued (the
  status line shows the count).
- First run of `yarn install` in `viewer/` can take several minutes; the webpack dev build a minute more.

## Scripts (repository root)

- `npm run lint`, `npm run typecheck`, `npm run test` — the form and the three packages.
- `npm run format:check` — Prettier check across the repository.
- `npm run check:graph` — feature-graph invariants.
- `npm run docs:build` — builds `docs/site/index.html`, a single-page reader of all project documents with clickable requirement IDs.

CI runs all of the above (plus a host-app build) on every pull request.
