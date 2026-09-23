# Coding conventions

Single source of truth for how code in this repository is written (decision A-13). ESLint and
Prettier enforce what they can (`npm run lint`, `npm run format:check`); the rest is enforced in
review. Every agent brief points here; a slice does not reach gate 2 with lint or format errors.

Precedence: this file → `eslint.config.js` / `.prettierrc.json` → personal habit. If a rule here
and the linter disagree, fix the linter config in the same PR and say so.

## 0. How this code is written

Plain React, no framework of our own: data instead of wrappers, effects instead of lifecycle
managers, schemas instead of guards, and every file readable in one pass. The sections below are
the detail; these seven sentences are the shape, and a change that breaks one of them is wrong
even when the linter is green.

1. **A hook returns what its name promises, or it does not exist.** `useScoringForm(study)` →
   `[rows, dispatch, channel]`; `useChannel(options)` → the channel; `useScoringBridge(hostOrigin,
ohif)` → the channel it provides. A hook that returns
   nothing is a hidden effect (the former `usePersistRows(rows)`, `useMessages(channel, handle)`):
   write the effect where it happens instead.
2. **An effect is written where it happens, and it has its pair.** Whatever the effect
   subscribes, its cleanup unsubscribes, in the same effect — `channel.on(handler)` on both
   sides, `ohif.on(handler)` in the OHIF-side application. No disposer lists, no "latest value"
   refs, no `pagehide` standing in for unmount.
3. **State is the data, not a wrapper around it.** The reducer runs over `Row[]`, not
   `{ rows }`; the channel's state is two fields, `{ ready, queued }`. No `FormState`, no `FormContext`, no "slot"
   objects made to carry one value.
4. **A message of the contract is an action, in both directions.** The viewer's events go into
   the reducer as they are, and what a button does is a command of the contract:
   `FormAction = ADD_ROW | REMOVE_ROW | HostCommand | ViewerEvent`, and the form's `dispatch`
   sends every command through the channel before it reduces (A-34). No translation layer between
   the wire and the state. The one event that needs a reaction, `VIEWER_READY`, gets it where it
   arrives: the handler dispatches the restore commands with the rows on screen, then the event
   itself. The handler is re-registered whenever the rows change, so it never reads a stale value
   through a ref or a re-read of storage (A-33). On the other side the same: `ohif.on` delivers
   OHIF's events already in the contract's shape, and `handleOhif` sends them.
5. **A function takes exactly what it needs and does one thing.** `activateRow(dispatch, row)`,
   `restoreViewer(dispatch, study, rows)`, `getStorage(studyInstanceUid)`. At most three inputs, no
   dependency bags, no factory that returns a function.
6. **A boundary is a schema; a guarantee is a tool's.** Everything foreign — the wire, OHIF's
   measurement object, `sessionStorage` — passes through one zod schema once. What the linter or
   React already guarantees (an exhaustive `switch`, a cleanup) is not written again in code.
7. **A component renders; a hook owns.** `ScoringPanel` calls one hook and renders;
   `MeasurementRow` calls `activateRow(dispatch, row)` from its own button; the page is layout
   only. On the viewer side the same: the provider renders its children around the channel
   `useScoringBridge` returns, and the hook owns the channel, the commands and the OHIF events.

## 1. Language and tooling

- TypeScript `strict` everywhere. No `any`; when an external type is genuinely unknown, use
  `unknown` and narrow, or write a one-line comment above a justified `// eslint-disable-next-line`.
- ESLint 9 flat config with `typescript-eslint` strict + stylistic (type-aware), `react-hooks`,
  `react-refresh`; Prettier for formatting (single quotes, semicolons, trailing commas, width 120 —
  raised from 100 on 2026-09-23 so a hook signature with its return type fits on one line).
- Dependencies: runtime dependencies of an app live in that workspace's `package.json`. Shared
  tooling lives at the root: ESLint, Prettier, Vitest, jsdom, Testing Library and the React type
  packages those tests rely on. npm hoists workspace packages unpredictably, and a test library
  hoisted to the root cannot see types left inside a workspace; CI runs `npm ci` from scratch and
  would catch the drift, a warm local `node_modules` does not.
- Node 22; npm workspaces at the root; the viewer fork uses its own yarn toolchain but follows this
  document for our extension.

## 2. Functions

- Arrow functions everywhere: components, hooks, utilities, event handlers, reducers.
  ```ts
  export const computeTotals = (rows: readonly Row[]): Total[] => { … };
  export const ScoringPanel = ({ rows }: ScoringPanelProps): JSX.Element => { … };
  ```
- A `function` declaration is allowed only when hoisting is genuinely required (mutual recursion
  in one module) and carries a comment saying so.
- Exported functions declare their return type explicitly. Internal helpers may infer.
- Prefer small named helpers over long inline lambdas; a callback longer than ~5 lines gets a name.
- **At most three inputs.** A function, factory, hook or helper takes no more than three inputs,
  counting positional parameters or, when it takes an options or dependencies object, that
  object's properties. More than three means it works with everything in the world: let it own
  what it was being handed, split it, or pass the one cohesive object that already exists (a
  channel, a service) instead of its members one by one. Nesting the extras in a sub-object to
  pass the count is not a fix, and an options bag of test-only seams does not escape the rule.
  React component props are exempt, and so is a signature a third party dictates (OHIF's
  extension parameters).
- **No function inside a `return` object.** A factory declares every method above, with a name,
  and returns a list of names: `return { services, commandsManager, on };`. The return then reads as
  the file's table of contents and each method can be found by its name. (The same rule for
  components is in §6.)
- **A factory is never called inside another call's argument list.** Declare the function or the
  value with a name above and pass it by name, so the call reads as a list of things that already
  exist. No `createX` for what is one variable or one function.
- Exhaustiveness over a discriminated union is the linter's job, not the code's:
  `@typescript-eslint/switch-exhaustiveness-check` fails the build when a `switch` over a message,
  action or status type misses a case, so a `switch` has no `default` branch and no
  `const exhaustive: never = …` line (removed 2026-09-22: it duplicated the rule in three places).

## 3. Enums, literals and constants

- Application state uses **string enums** where a value is compared or stored: row status.
  ```ts
  export enum RowStatus {
    Pending = 'pending',
    Drawing = 'drawing',
    Done = 'done',
  }
  ```
  Reducer actions are string-literal `type`s, like the wire messages, because the viewer's events
  are dispatched to the reducer as they are (`FormAction = UserAction | ViewerEvent`); an enum
  would force a translation layer between the two.
- Numeric enums are forbidden (lint rule). Do not use `const enum`.
- The **wire contract** (`packages/contract`) keeps string-literal union types (`type: 'ACTIVATE_TOOL'`)
  and `as const` tuples: it is the serialised format, copied into the OHIF fork, and stays free of
  TypeScript-only constructs. App code may map contract literals to enums at the boundary, never the
  other way round.
- Module-level constants: `UPPER_SNAKE_CASE` for true constants (`VIEWER_ORIGIN`, `DEFAULT_TOOL`),
  `camelCase` for everything else. No magic numbers: a timing or size value gets a named constant
  with a comment stating the reason for the value.

## 4. Naming

| Thing                                | Style                                                                        | Example                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Types, interfaces, enums, components | PascalCase                                                                   | `MeasurementRow`, `BridgeState`                                                |
| Variables, functions, hooks          | camelCase; hooks start with `use`                                            | `createOhif`, `useChannel`                                                     |
| Files: components                    | PascalCase `.tsx`                                                            | `TotalsFooter.tsx`                                                             |
| Files: types and styles              | `.props.ts` next to a React component, and nowhere else (A-27)               | `TotalsFooter.props.ts`                                                        |
| Files: everything else               | kebab-case or camelCase, one concept per file                                | `host-channel.ts` / `hostChannel.ts` (keep the existing style within a folder) |
| Tests                                | `__tests__/` folder inside the folder of the code under test, `*.test.ts(x)` | `state/__tests__/reducer.test.ts`                                              |
| Booleans                             | `is`/`has`/`can`/`should` prefix                                             | `isReady`, `hasMetrics`                                                        |
| Event handlers                       | `on<Event>` for props, `handle<Event>` for implementations                   | `onRemove` / `handleRemove`                                                    |
| Interfaces for props                 | `<Component>Props`                                                           | `ScoringPanelProps`                                                            |

No `I` prefix on interfaces, no Hungarian notation, no abbreviations except `id`, `uid`, `url`.

## 5. Modules and imports

Where a file belongs is set by [`docs/PROJECT-STRUCTURE.md`](PROJECT-STRUCTURE.md): components,
pages, hooks and generic helpers follow the conventional React layout, while the message channel and
the row model keep their own feature folders. Instructions that apply to one part of the repository
live in `.claude/rules/` with a `paths` glob, not in `CLAUDE.md`.

- One concern per module: a module exports one idea (a factory, a hook, a component, a pure
  helper set) and is named after it. A file over ~150 lines of code or a function over ~50 lines is
  a signal to split, and the lint reports it.
- Split by role, not by size: the bridge is messaging, handshake and the measurement stream; a
  hook is user actions or event synchronisation, not both. A factory that does more than three
  things is two factories and a composition root that wires them.
- A composition root (`ScoringBridge.tsx`, `main.tsx`, a top-level hook) only creates and connects; it holds
  no branching logic of its own.
- Repeated lookups become named selectors (`findRow`, `findRowByUid` in `state/selectors.ts`) instead of inline `find`
  calls scattered through a module.
- Never use a mutable placeholder to break a circular dependency
  (`let forget = () => undefined` reassigned later). Pass the dependency explicitly, or move the
  shared state into the module that owns it.
- Named exports only; no default exports except where a framework requires one (OHIF extension
  entry, Vite config).
- Import order: node built-ins, external packages, our published packages
  (`@bdiadiun/scoring-contract`), then `@app/…`, then `./` inside the same folder. The order is the
  rule; no blank line is required between the groups, and none of this repository has ever had one.
  Use `import type` for type-only imports (lint rule).
- In the application, an import that crosses a folder uses the `@app/*` alias, which resolves to
  `host-app/src/*`; `./` stays inside one folder, where it is the more precise statement. The alias
  is the application's alone: `packages/*` keep relative imports, because they are published and an
  alias would resolve here and fail in a consumer's build. Whatever resolves imports for a check,
  the graph script included, has to learn the alias too, or it stops checking them and still
  reports success.
- No barrel `index.ts` re-exports inside the app; import from the module that owns the symbol.
- **A `.props.ts` file belongs to a React component only.** In a package, a type lives beside the
  code that implements it; the one exception is a file that only describes a third party's surface
  (`ohif.ts`). A type used by one file is declared in that file without `export`; a package's
  `index.ts` exports what another package or the application uses and nothing else.
- **The channel is transport, the extension is what a message means** (A-29, A-31). The channel
  knows origin, version, the guard, `send`, one `on` handler and the queue until `readyOn`;
  it never reads a field of a message. The armed row, announcing once and everything OHIF live in
  the extension; the form's state lives in the form.
- Never reach into another package's internals; the contract package is consumed through its
  public entry only.
- **A shape is declared once, by the package that owns the idea.** Before writing an interface, a
  schema or a constant, search the packages for one that already says it: `MessageHandlers` and
  `ChannelState` belong to the channel, every message and vocabulary schema (`ToolName`, `Metrics`,
  `MeasurementGeometry`) to the contract, the initial channel state to the channel. The application
  extends or picks from those (`Row.omit(...)` and `Metrics.nullable()` in the stored-row schema)
  instead of listing the members again.
- **The contract is zod schemas (A-26).** A message is one `z.object`; the two directions are
  `z.discriminatedUnion('type', …)`; a type is `z.infer` of the schema of the same name; a guard is
  `safeParse(value).success`. No hand-written `isRecord` / `isNonEmptyString` guards anywhere: a
  consumer that must check a shape builds a schema from the contract's.
- **A folder names a side or a role (A-27).** Channel: two files, no folder; extension:
  `commands/`, `events/`, `ohif/`; application: the conventional React layout — `components/`,
  `pages/`, `hooks/`, `state/` (reducer, selectors, actions), `services/` (channel, storage),
  `utils/` (format, totals). No file under twenty lines (a constant, a type or a one-function module joins its owner), except a
  package `index.ts`, `main.tsx`, a component's `.props.ts` and a file the standard layout names
  (`state/selectors.ts`, a page; A-33, A-34). Tests move with the code they test.
- **No code for a caller that does not exist.** A default every caller overrides, an export only a
  test imports, a counter nothing displays and a branch a guard upstream makes unreachable are
  removed, not kept "for later"; a one-line function that only renames an expression is inlined.

## 6. React

- Function components as arrows, props typed with an interface, explicit `JSX.Element` return type
  on exported components.
- State: `useReducer` for multi-field state with transitions (rows), `useState` for independent
  scalars. Reducers are pure and return the same reference when nothing changes.
- Effects: every subscription, listener or timer created in an effect is removed in its cleanup
  (Q-5). Effect dependency arrays are complete (`react-hooks/exhaustive-deps` is an error, not a
  warning). Helpers used inside an effect live inside it or are stable (`useCallback`, module scope).
- No context providers until two unrelated subtrees need the same state; prop drilling two levels
  is fine.
- **A component always has a sibling `{Name}.props.ts`** holding its props, its other types and its
  `styles`; the `.tsx` keeps only rendering. **No other module has one** (A-27): a module's types
  live in the module, beside the code that uses them (`Row` and `FormAction` are
  in `state/reducer.ts`). An `enum` is a value rather than a type and stays with its
  code.

  ```ts
  // MeasurementRow.props.ts
  import type { CSSProperties } from 'react';
  import type { Row } from '@app/state/reducer';

  export interface MeasurementRowProps {
    row: Row;
    index: number;
    onActivate: (rowId: string) => void;
  }

  export const styles = {
    row: { display: 'flex', gap: '8px' },
    status: { color: '#666' },
  } satisfies Record<string, CSSProperties>;
  ```

  ```tsx
  // MeasurementRow.tsx
  import { styles, type MeasurementRowProps } from './MeasurementRow.props';

  export const MeasurementRow = ({ row, index, onActivate }: MeasurementRowProps): JSX.Element => (
    <div style={styles.row}>…</div>
  );
  ```

- No inline style object literals in JSX (`style={{ … }}`); reference `styles.<key>` from the
  `.props.ts` file (lint rule). A style that depends on state is a small function in the same file,
  e.g. `rowStyle(focusable)` returning `styles.row` merged with `styles.rowClickable`. A component without props or styles does not need the file.
- Types shared by several modules live with the module that owns them (e.g. `Row` in
  `state/reducer.ts`) and are imported from there rather than copied.
- No function is created inside the `return` statement. Every function a component renders with is
  declared in the component body with a name, above the `return`, and the returned JSX mentions it
  by that name. The one exception is the callback of a list render, `rows.map(...)`, because
  extracting it would mean inventing a component for every list.
- No functions are created inside JSX event handler props. `onClick`, `onKeyDown`, `onChange` and
  every other `on…` prop receives a named `handleX` arrow declared in the component body (or a
  prop passed in), never an inline arrow, function expression or `.bind` call (lint rule). When a
  handler needs a value the component already has, that value is read inside the handler; when a
  list renders one component per item, the handler lives in that item component, which is why
  `MeasurementRow` owns its own `handleActivate`, `handleCancel` and `handleRemove`.
- User-visible strings come from `i18n.ts` (A-7); no literals in JSX.

## 7. Errors, logging and defensive code

- Validate every external input at the boundary (`postMessage` payloads through the contract
  schemas; `sessionStorage` through the stored-row schema; OHIF measurement objects through
  `toMetrics`). Inside the boundary, trust the types.
- Ignored input is logged once with a reason at the level that matches its severity:
  `console.debug` for expected noise (foreign origins, mid-drag frames), `console.info` for
  intentional no-ops, `console.warn` for something a developer should look at, `console.error`
  for broken invariants. `console.log` is not used (lint rule).
- No silent `catch {}`; a swallowed error is logged with context.
- No `!` non-null assertions; narrow explicitly.

## 8. Comments

- **No comments in the packages** (A-24, author's decision 2026-09-22). Names, small functions and
  types carry the meaning; a comment loads the reader and gets in the way of remembering the code.
  What the code cannot say — the reason for a call, the OHIF or cornerstone `file:line` that
  justifies it, the decision behind it — lives in `docs/notes/bridge-internals.md` and
  `docs/decisions/`, where it is read on purpose rather than skipped over. The one exception is
  a directive the tooling needs (`eslint-disable`, `@ts-expect-error`, the DefinePlugin note above
  `declare const process`), kept to one line.
- In the application the same rule applies; a component's `.props.ts` needs no explanation of its
  own props.
- No commented-out code, no TODO without an owner and a follow-up entry in `docs/STATE.md`.
- English only; no mention of AI tools anywhere in code (AI usage is documented in `AI-USAGE.md`).

## 9. Tests

- Test files live in a `__tests__/` folder inside the folder of the code they test:
  `host-app/src/state/__tests__/reducer.test.ts` tests `host-app/src/state/reducer.ts` and imports it as
  `@app/state/reducer`. One test file per module under test; shared test helpers go to
  `__tests__/helpers.ts` in the same folder.

- Vitest. Targeted tests only (X-4): pure logic (reducers, totals, throttle, contract schemas) and
  the bridge client behaviour. No snapshot tests, no tests of styling.
- Test names read as behaviour: `it('queues a command sent before VIEWER_READY and flushes it in order')`.
- Arrange / act / assert with blank lines between; one behaviour per test; assert on state or on
  calls (`vi.fn()`), not on implementation details.
- Reference equality (`toBe`) is used to assert "nothing changed" in reducers.
- A bug fix comes with the test that would have caught it.

## 10. Verification

Every rule here was written after something in this repository broke in exactly the way it
describes. The cause is kept in the text, because a rule whose reason is forgotten is the first one
somebody deletes.

- **Green on a warm tree is not green.** Before a slice is presented, the verification runs from a
  cold state: every package's build output and every `node_modules` deleted, then a clean install.
  Two slices passed locally and failed on a fresh machine, once because test tooling sat where only
  one workspace could see it, once because the packages built in whatever order the package manager
  chose.
- **Run on the version in `.nvmrc`, and say which version ran.** A suite that dies inside jsdom on a
  different Node version has told you nothing about the change.
- **Prove, do not assert.** A claim that a type check is exhaustive, that a lint rule fires, or that
  a published surface is unchanged is shown with its artefact: the compiler error, a probe file and
  its output, the compared list of exported names. The probe is deleted afterwards and the deletion
  is stated.
- **Nothing rides along.** A change in the working tree that the brief did not ask for is reported
  and reverted, not committed with the slice.
- **A rule lives only as long as its reason.** When the cause of a constraint disappears, the
  constraint is revisited in the slice that removes the cause. The contract stayed one 345-line file
  for three slices after the copy that required it was gone.
- **A folder excluded from the build needs a project of its own.** A package's tests are kept out of
  its build so they cannot reach `dist`, and that exclusion also takes them out of every type-aware
  check: for a while the packages' tests were neither type-checked nor linted with types, and
  nothing said so. Each package therefore carries a second TypeScript project that includes its
  tests, and the lint configuration points at it.
- **Under `set -e`, a non-zero status that means something is captured, not assumed.** A workflow
  step runs with `bash -e`, so `value=$(fn)` aborts the whole script when `fn` returns non-zero as a
  normal signal, and the line that reads `$?` never runs. Write `value=$(fn) || status=$?`. This
  shipped: the publish run died the first time a package legitimately had nothing to release, and
  the packages after it were never considered.
- **A list of packages is a trap; use a pattern.** Wherever tooling enumerates the packages, a new
  one is forgotten and nothing fails: three times in a row a package was merged with tests no
  command collected. Where the tool allows a glob, it gets one.
- **An instruction that names a command must name the one that works.** Ours told the agents to
  start the viewer the way it was started before it needed configuration; that way it comes up with
  no host origin, refuses to bridge and never shakes hands, and the run looks like a broken
  application rather than a wrong command. When a script replaces a raw command, every instruction
  that quoted the raw one changes in the same slice.
- **A test that no command runs does not exist.** New tests are added to what `npm run test`
  actually collects, and the case count is reported before and after, so the increase is visible
  rather than assumed.
- **Every fix leaves a rule behind.** The slice that fixes something also writes the general rule
  here or in the matching file under `.claude/`, naming the failure in one clause. A fix that leaves
  no rule behind gets made again.

## 11. Publishing

- **A published version is that content for ever, so a number is never reused.** Skipping a release
  because the version already exists is right only when what is there is what we would publish. A
  number left over from an earlier mechanism was reused for different content: the release was
  skipped, and three packages shipped pinned to a contract that did not contain what they imported.
  Before skipping, the run compares what it would publish against what the registry serves, and
  fails loudly when they differ.
- **A version lives in the manifest, not in the release run.** The slice that changes a package
  raises that package's version, and the workflow publishes exactly that version and skips when it
  already exists. A version computed at release time cannot be named by anything that depends on
  it, which is how an adapter came to pin a version of its own dependency that predated the types
  it imported.
- **A workspace link hides version skew, so an internal pin is verified against the registry.** Here
  a sibling package is symlinked and compiles against the working tree, no matter what version the
  manifest names. Before pinning, fetch the published tarball of that exact version and check that
  what the dependent imports is really in it.
- **The browser scenario runs on the working tree before anything is published.** `npm run
viewer:link` swaps the fork's installed copies of our packages for symlinks to `packages/*`; the
  scenario passes there first, then the release is cut and pinned. A version is never published to
  find out whether it works.
- **The dependency is published before the dependent.** A package pinned at an exact version cannot
  be released in the same step as the thing that pins it.
- **A new package is added to the publish workflow in the slice that creates it.** The workflow
  names its packages one by one; a package missing from that list is built, tested and merged while
  never reaching the registry, and nothing says so until something tries to install it.
- **Only a package that changed is released.** A run that bumps every package produces empty
  versions and makes the version number stop meaning anything.
- **The version is never committed back to `main`**, because direct commits there are forbidden; it
  is derived in the workflow and used for the publish only.

## 12. Git and review

- Conventional Commits, English, no trailers, no AI mentions (CLAUDE.md §4).
- Generated files are never edited by hand and are committed with their source in the same commit:
  `docs/FEATURE-GRAPH.md` from `docs/feature-graph.json` (`npm run graph:build`),
  `docs/site/index.html` (`npm run docs:build`). CI fails when either is stale.
- A PR is one slice; its description follows the template in CLAUDE.md and cites canon IDs.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run check:graph`
  all pass before gate 2. A PR that changes docs also runs
  `npm run docs:build` and commits the result.

## 13. The OHIF fork

- No code of ours lives there. The fork registers one package, the adapter
  `@bdiadiun/ohif-extension-scoring-adapter`, which registers our extensions itself; the bridge
  arrives as its dependency. The fork carries that entry, the matching dependency and its workflow,
  and nothing else (A-20). Adding a capability is a change to the adapter, not to the fork.
- We never describe OHIF's types, we describe the members we call, in the package's own
  `ohif.ts`. No `any` for an OHIF object: the narrowest structural type that covers what we
  actually use. Because that model replaces the compiler's knowledge of OHIF, a drift from the real
  API cannot be caught by a type check; building the viewer and running the browser scenario is how
  it is caught, and both belong to any slice that touches this code.
- Command names are prefixed per package. OHIF namespaces module ids by extension but not command
  names, so an unprefixed name silently replaces another extension's command.
