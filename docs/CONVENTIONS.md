# Coding conventions

Single source of truth for how code in this repository is written (decision A-13). ESLint and
Prettier enforce what they can (`npm run lint`, `npm run format:check`); the rest is enforced in
review. Every agent brief points here; a slice does not reach gate 2 with lint or format errors.

Precedence: this file → `eslint.config.js` / `.prettierrc.json` → personal habit. If a rule here
and the linter disagree, fix the linter config in the same PR and say so.

## 1. Language and tooling

- TypeScript `strict` everywhere. No `any`; when an external type is genuinely unknown, use
  `unknown` and narrow, or write a one-line comment above a justified `// eslint-disable-next-line`.
- ESLint 9 flat config with `typescript-eslint` strict + stylistic (type-aware), `react-hooks`,
  `react-refresh`; Prettier for formatting (single quotes, semicolons, trailing commas, width 100).
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
- **A factory is never called inside another call's argument list.** Declare the function or the
  value with a name above and pass it by name, so the call reads as a list of things that already
  exist. No `createX` for what is one variable or one function.
- Exhaustiveness over a discriminated union is never left to discipline. Either a `switch` keeps a
  `default` branch narrowing to `never`, or a registration map is written with a `satisfies` clause
  against the union of keys, as the viewer adapter does; both fail the build when a case is added
  and not handled.
- A `switch` over an action, message or status type keeps its `default` branch narrowing to `never`,
  so a new case added to the type fails the type check instead of being silently ignored.

## 3. Enums, literals and constants

- Application state uses **string enums**: row status, reducer action types, bridge states, UI
  modes. Members are PascalCase, values are the lowercase or SCREAMING_CASE string they represent.
  ```ts
  export enum RowStatus { Pending = 'pending', Drawing = 'drawing', Done = 'done' }
  export enum FormActionType { AddRow = 'ADD_ROW', ArmRow = 'ARM_ROW', … }
  ```
- Numeric enums are forbidden (lint rule). Do not use `const enum`.
- The **wire contract** (`packages/contract`) keeps string-literal union types (`type: 'ACTIVATE_TOOL'`)
  and `as const` tuples: it is the serialised format, copied into the OHIF fork, and stays free of
  TypeScript-only constructs. App code may map contract literals to enums at the boundary, never the
  other way round.
- Module-level constants: `UPPER_SNAKE_CASE` for true constants (`VIEWER_ORIGIN`, `DEFAULT_TOOL`),
  `camelCase` for everything else. No magic numbers: a timing or size value gets a named constant
  with a comment stating the reason for the value.

## 4. Naming

| Thing                                | Style                                                                           | Example                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Types, interfaces, enums, components | PascalCase                                                                      | `MeasurementRow`, `BridgeState`                                                    |
| Variables, functions, hooks          | camelCase; hooks start with `use`                                               | `createOrchestrator`, `useScoringForm`                                             |
| Files: components                    | PascalCase `.tsx`                                                               | `TotalsFooter.tsx`                                                                 |
| Files: types and styles              | `.props.ts` next to a component always, next to another module when it earns it | `TotalsFooter.props.ts`, `rows.props.ts`                                           |
| Files: everything else               | kebab-case or camelCase, one concept per file                                   | `create-channel.ts` / `createChannel.ts` (keep the existing style within a folder) |
| Tests                                | `__tests__/` folder inside the folder of the code under test, `*.test.ts(x)`    | `form/__tests__/rows.test.ts`                                                      |
| Booleans                             | `is`/`has`/`can`/`should` prefix                                                | `isReady`, `hasMetrics`                                                            |
| Event handlers                       | `on<Event>` for props, `handle<Event>` for implementations                      | `onRemove` / `handleRemove`                                                        |
| Interfaces for props                 | `<Component>Props`                                                              | `ScoringPanelProps`                                                                |

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
- A composition root (`createOrchestrator`, `App`, a top-level hook) only creates and connects; it holds
  no branching logic of its own.
- Repeated lookups become named selectors (`findRow`, `findRowByUid`) instead of inline `find`
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
- **Protocol goes to the channel, OHIF stays in the extension** (A-23). The test for a piece of
  viewer-side code is whether it can be understood without OHIF: announcing readiness, the armed
  row, answering a command can, and live in the channel; activating a tool or reading
  `cachedStats` cannot, and live in the extension.
- Never reach into another package's internals; the contract package is consumed through its
  public entry only.
- **A shape is declared once, by the package that owns the idea.** Before writing an interface, a
  guard or a constant, search the packages for one that already says it: `Disposable` and
  `MessageOfType` belong to the channel, the primitive guards (`isOneOf`, `isFiniteNumber`,
  `isMetrics`) and every vocabulary table to the contract, the initial channel state to the
  channel. The application extends or picks from those (`extends RowActions`,
  `Pick<ToolCommands, 'getArmed' | 'disarm'>`) instead of listing the members again.
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
  `styles`; the `.tsx` keeps only rendering. **Another module has one when it earns it**: when the
  declarations run past about twenty lines, or when another module imports them, so the type has a
  stable home. A module with one or two types nobody else uses keeps them beside the code; the rule
  existed to keep files readable, and splitting a thirty-line module in two serves nothing but the
  rule itself. For a component that means
  the props interface and the styles; for a module it means the shapes its functions take and
  return. The suffix is `.props.ts` everywhere, deliberately: one name, one lint rule, no argument
  about which file a declaration belongs in. An `enum` is a value rather than a type and stays with
  its code. Two files are exempt: `packages/contract/src/messages.ts`, which must stay one
  self-contained file with no imports because it is the published wire contract, and test files.

  ```ts
  // MeasurementRow.props.ts
  import type { CSSProperties } from 'react';
  import type { Row } from '../form/rows';

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
- Types shared by several modules live with the module that owns them, in that module's
  `.props.ts` (e.g. `Row` in `form/rows.props.ts`), and are imported from there rather than copied.
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
  guards; OHIF measurement objects through `toMetrics`). Inside the boundary, trust the types.
- Ignored input is logged once with a reason at the level that matches its severity:
  `console.debug` for expected noise (foreign origins, mid-drag frames), `console.info` for
  intentional no-ops, `console.warn` for something a developer should look at, `console.error`
  for broken invariants. `console.log` is not used (lint rule).
- No silent `catch {}`; a swallowed error is logged with context.
- No `!` non-null assertions; narrow explicitly.

## 8. Comments

Code should read without comments: names, small functions and types carry the meaning. A comment
is a cost every reader pays, so it has to earn its place.

Write a comment only when the code cannot say _why_:

- non-obvious behaviour of OHIF, cornerstone or the browser that the code depends on, with a short
  `file:line` citation at the pinned version;
- a workaround or a deliberate deviation from the obvious approach;
- a security-relevant check whose purpose is not evident from the condition itself.

Rules:

- One to three lines. A longer rationale belongs in `docs/decisions/A-n-*.md` or `ARCHITECTURE.md`;
  the code carries at most a pointer, e.g. `// A-8: the viewer owns measurement ids.`
- No comments that restate the code, no JSDoc that repeats a name or its types, no section banners.
- Canon and decision IDs only where a decision is implemented, not on every block; traceability
  lives in `docs/FEATURE-GRAPH.md`, `ARCHITECTURE.md` and `docs/DEFENCE.md`.
- No commented-out code, no TODO without an owner and a follow-up entry in `docs/STATE.md`.
- English only; no mention of AI tools anywhere in code or comments (AI usage is documented in
  `AI-USAGE.md`).
- Target: comment lines stay under about 10% of non-blank lines in a file. More than that is a
  signal to rename, extract a function, or move the explanation into the docs.

## 9. Tests

- Test files live in a `__tests__/` folder inside the folder of the code they test:
  `host-app/src/form/__tests__/rows.test.ts` tests `host-app/src/form/rows.ts` and imports it as
  `../rows`. One test file per module under test; shared test helpers go to
  `__tests__/helpers.ts` in the same folder.

- Vitest. Targeted tests only (X-4): pure logic (reducers, totals, throttle, contract guards) and
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
