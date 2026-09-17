# artifact-synchronization

A micro-frontend pair: an OHIF Viewer fork with a bridge extension, and a host app with a scoring
form. They run on separate ports and talk only over `window.postMessage`.

- Requirements: [docs/CANON.md](docs/CANON.md); work breakdown: [docs/FEATURE-GRAPH.md](docs/FEATURE-GRAPH.md).
- Message contract and decisions: [ARCHITECTURE.md](ARCHITECTURE.md); AI usage: [AI-USAGE.md](AI-USAGE.md); defence notes: [docs/DEFENCE.md](docs/DEFENCE.md).
- Layout: `host-app/` (React + Vite, port 5173), `packages/contract/` (shared message types),
  `viewer/` (git submodule → [bdiadiun/Viewers](https://github.com/bdiadiun/Viewers), branch `scoring`,
  based on OHIF `v3.12.17`, port 3000).

## Prerequisites

- Node.js 22 (`.nvmrc`; `nvm use` if you use nvm).
- Git with submodule support. Yarn 1 is provided by corepack (bundled with Node), no global install.
- Ports 3000 (viewer) and 5173 (host app) free. Both are fixed: the apps check each other's origin.
- Time: the first run takes about 5–10 minutes (submodule clone, `yarn install`, first webpack
  build); later starts take seconds.

## Run from a clean machine

```sh
git clone --recurse-submodules https://github.com/bdiadiun/artifact-synchronization.git
cd artifact-synchronization
```

If you already cloned without submodules: `git submodule update --init`.

### 1. Viewer (port 3000)

```sh
corepack enable
cd viewer
yarn install            # OHIF monorepo, several minutes on first run
yarn --cwd platform/app dev
```

Wait for "compiled successfully", then check http://localhost:3000/viewer?StudyInstanceUIDs=1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1
opens a study. Notes:

- Run the dev server from `platform/app` as shown, not `yarn dev` at the viewer root; the root
  script picks up a `bun.lock` and requires bun.
- The dev server opens a browser tab at `http://localhost:3000/` (the study list) on every start.
  Set `OHIF_OPEN=false` to suppress it: `OHIF_OPEN=false yarn --cwd platform/app dev`.
- `yarn install` prints many `unmet peer dependency` warnings and two
  `Workspaces can only be enabled in private projects` warnings; the webpack build ends with one
  `InjectManifest ... --watch mode` warning. All of these are expected and harmless.

### 2. Host app (port 5173), in a second terminal

```sh
npm install             # installs host-app and packages/contract (npm workspaces)
npm run dev --workspace host-app
```

Open http://localhost:5173. The left pane embeds the viewer; the status line in the right panel
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

- `npm run lint`, `npm run typecheck`, `npm run test` — host-app and contract package.
- `npm run lint:fork` — style rules from `docs/CONVENTIONS.md` applied to the OHIF extension source.
- `npm run format:check` — Prettier check across the repository.
- `npm run check:graph` — feature-graph invariants.
- `npm run check:contract` — the viewer extension's copy of the contract is byte-identical to `packages/contract`.
- `npm run docs:build` — builds `docs/site/index.html`, a single-page reader of all project documents with clickable requirement IDs.

CI runs all of the above (plus a host-app build) on every pull request.
