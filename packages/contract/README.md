# @bdiadiun/scoring-contract

Single source of truth for the host-app <-> viewer `postMessage` contract (canon Q-7).

`src/messages.ts` is TypeScript source consumed directly by Vite/Vitest/tsc — built to `dist` by the package's own `prepare` script.
The same file must be copied byte-for-byte into
`viewer/extensions/scoring-bridge/src/contract/messages.ts`, because the viewer is a git
submodule that must stay self-contained and cannot import outside itself. Run
`npm run check:contract` at the repo root to verify the copy is in sync.
