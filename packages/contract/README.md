# @bdiadiun/scoring-contract

Single source of truth for the host-app <-> viewer `postMessage` contract (canon Q-7).

Published to npm; the form, the orchestrator package and the viewer extension all depend on it at
an exact version. There is no copy of it anywhere: the extension consumed a byte-identical copy
until decision A-15 replaced that with this package.

The source is split by concern behind one entry, `src/index.ts`:

| Module            | Holds                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| `vocabulary`      | the version constant, units, tool names, metric keys and the geometry |
| `hostCommands`    | the commands the form sends, and the guard that validates one         |
| `viewerEvents`    | the events the viewer sends, and the guard that validates one         |
| `primitiveGuards` | the shared checks both guards are built from                          |

Types live in a sibling `.props.ts` next to the module that owns them, as everywhere else in this
repository. `dist` is built by the package's own `prepare` script, and a merge into `main` that
changes the package publishes a patch release.
