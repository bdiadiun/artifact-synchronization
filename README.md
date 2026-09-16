# artifact-synchronization

A microfrontend pair — an OHIF Viewer fork with a bridge extension, and a host app with a
scoring form — that talk to each other over `window.postMessage` on separate ports.

See [docs/CANON.md](docs/CANON.md) for the full requirements and [docs/FEATURE-GRAPH.md](docs/FEATURE-GRAPH.md)
for how the work is sliced.

## Prerequisites

- Node.js 22 (see `.nvmrc`; run `nvm use` if you have nvm installed).

## Run host-app

```sh
cd host-app
npm install
npm run dev
```

Open http://localhost:5173. At this stage the viewer fork (port 3000) has not been added yet,
so the iframe on the left will show a connection error — that is expected until the viewer bridge
extension slice lands.

## Scripts (inside `host-app/`)

- `npm run lint` — lint the source with oxlint.
- `npm run typecheck` — type-check with `tsc --noEmit`.
- `npm run test` — run the unit tests with Vitest.
- `npm run build` — type-check and produce a production build.
