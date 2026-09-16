# artifact-synchronization

A micro-frontend pair: an OHIF Viewer fork with a bridge extension, and a host app with a scoring
form. They run on separate ports and talk only over `window.postMessage`.

- Requirements: [docs/CANON.md](docs/CANON.md); work breakdown: [docs/FEATURE-GRAPH.md](docs/FEATURE-GRAPH.md).
- Message contract and decisions: [ARCHITECTURE.md](ARCHITECTURE.md).
- Layout: `host-app/` (React + Vite, port 5173), `packages/contract/` (shared message types),
  `viewer/` (git submodule → [bdiadiun/Viewers](https://github.com/bdiadiun/Viewers), branch `scoring`,
  based on OHIF `v3.12.17`, port 3000).

## Prerequisites

- Node.js 22 (`.nvmrc`; `nvm use` if you use nvm).
- Git with submodule support. Yarn 1 is provided by corepack (bundled with Node), no global install.

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

Wait for the webpack build to finish, then check http://localhost:3000/viewer?StudyInstanceUIDs=1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1
opens a study. Note: run the dev server from `platform/app` as shown, not `yarn dev` at the
viewer root; the root script picks up a `bun.lock` and requires bun.

### 2. Host app (port 5173), in a second terminal

```sh
npm install             # installs host-app and packages/contract (npm workspaces)
npm run dev --workspace host-app
```

Open http://localhost:5173. The left pane embeds the viewer; the status line in the right panel
turns to "готовий" once the viewer has sent `VIEWER_READY`.

## Scripts (repository root)

- `npm run lint`, `npm run typecheck`, `npm run test` — host-app and contract package.
- `npm run check:graph` — feature-graph invariants.
- `npm run check:contract` — the viewer extension's copy of the contract is byte-identical to `packages/contract`.
