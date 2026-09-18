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

| Thing                                | Style                                                                        | Example                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Types, interfaces, enums, components | PascalCase                                                                   | `MeasurementRow`, `BridgeState`                                                  |
| Variables, functions, hooks          | camelCase; hooks start with `use`                                            | `createBridge`, `useScoringForm`                                                 |
| Files: components                    | PascalCase `.tsx`                                                            | `TotalsFooter.tsx`                                                               |
| Files: component types and styles    | PascalCase `.props.ts` next to the component                                 | `TotalsFooter.props.ts`                                                          |
| Files: everything else               | kebab-case or camelCase, one concept per file                                | `create-bridge.ts` / `createBridge.ts` (keep the existing style within a folder) |
| Tests                                | `__tests__/` folder inside the folder of the code under test, `*.test.ts(x)` | `form/__tests__/rows.test.ts`                                                    |
| Booleans                             | `is`/`has`/`can`/`should` prefix                                             | `isReady`, `hasMetrics`                                                          |
| Event handlers                       | `on<Event>` for props, `handle<Event>` for implementations                   | `onRemove` / `handleRemove`                                                      |
| Interfaces for props                 | `<Component>Props`                                                           | `ScoringPanelProps`                                                              |

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
- A composition root (`createBridge`, `App`, a top-level hook) only creates and connects; it holds
  no branching logic of its own.
- Repeated lookups become named selectors (`findRow`, `findRowByUid`) instead of inline `find`
  calls scattered through a module.
- Never use a mutable placeholder to break a circular dependency
  (`let forget = () => undefined` reassigned later). Pass the dependency explicitly, or move the
  shared state into the module that owns it.
- Named exports only; no default exports except where a framework requires one (OHIF extension
  entry, Vite config).
- Import order: node built-ins, external packages, workspace packages (`@scoring/contract`),
  relative imports; blank line between groups. Use `import type` for type-only imports (lint rule).
- No barrel `index.ts` re-exports inside the app; import from the module that owns the symbol.
- Never reach into another package's internals; the contract package is consumed through its
  public entry only.

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
- Every component `{Name}.tsx` has a sibling `{Name}.props.ts` that holds everything that is not
  rendering: the props interface, other types and interfaces the component uses, and its style
  objects. The `.tsx` file keeps only the component and its local logic.

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
- Types shared by several components live with the module that owns them (e.g. `Row` in
  `form/rows.ts`), not in a component's `.props.ts`.
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

## 10. Git and review

- Conventional Commits, English, no trailers, no AI mentions (CLAUDE.md §4).
- Generated files are never edited by hand and are committed with their source in the same commit:
  `docs/FEATURE-GRAPH.md` from `docs/feature-graph.json` (`npm run graph:build`),
  `docs/site/index.html` (`npm run docs:build`), and the extension's `contract/messages.ts` copied
  from `packages/contract/src/messages.ts` (`npm run check:contract`). CI fails when any of them is
  stale.
- A PR is one slice; its description follows the template in CLAUDE.md and cites canon IDs.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run check:graph`,
  `npm run check:contract` all pass before gate 2. A PR that changes docs also runs
  `npm run docs:build` and commits the result.

## 11. The OHIF fork

- Only `extensions/scoring-bridge/` and the one registration line in `pluginConfig.json` change.
- The extension follows this document. The fork's own ESLint does not run at v3.12.17 (ESLint 9
  with a legacy `.eslintrc.json` and `@typescript-eslint` 5 crashes while loading rules), and we do
  not replace OHIF's tooling. `npm run lint:fork` applies the rules from this document that need no
  type information (`scripts/eslint-fork-style.config.js`); the fork's Prettier formats the
  extension, except the contract copy, which keeps this repository's formatting to stay
  byte-identical. Type-aware rules are checked in review.
- `AppTypes` and other OHIF globals are used as typed; no `any` for OHIF objects, use the narrowest
  structural type that covers what we read.
