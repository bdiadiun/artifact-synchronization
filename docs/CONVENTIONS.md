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

| Thing                                | Style                                                      | Example                                                                          |
| ------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Types, interfaces, enums, components | PascalCase                                                 | `MeasurementRow`, `BridgeState`                                                  |
| Variables, functions, hooks          | camelCase; hooks start with `use`                          | `createBridge`, `useScoringForm`                                                 |
| Files: components                    | PascalCase `.tsx`                                          | `TotalsFooter.tsx`                                                               |
| Files: everything else               | kebab-case or camelCase, one concept per file              | `create-bridge.ts` / `createBridge.ts` (keep the existing style within a folder) |
| Tests                                | next to the source, `*.test.ts(x)`                         | `rows.test.ts`                                                                   |
| Booleans                             | `is`/`has`/`can`/`should` prefix                           | `isReady`, `hasMetrics`                                                          |
| Event handlers                       | `on<Event>` for props, `handle<Event>` for implementations | `onRemove` / `handleRemove`                                                      |
| Interfaces for props                 | `<Component>Props`                                         | `ScoringPanelProps`                                                              |

No `I` prefix on interfaces, no Hungarian notation, no abbreviations except `id`, `uid`, `url`.

## 5. Modules and imports

- One concern per module; a file over ~200 lines is a hint to split.
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
- Inline styles are acceptable for this assignment's grey form (X-3); keep them small and local.
  A component with more than ~6 style properties gets a CSS class in `App.css`.
- User-visible strings come from `ui-strings.ts` (A-7); no literals in JSX.

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

- Comments explain _why_, not _what_. A branch that exists because of a requirement, a decision
  or an OHIF quirk cites it: `// Q-1: commands before VIEWER_READY are queued, never dropped.`
- OHIF behaviour that we depend on is cited with `file:line` in the fork at the version we pin.
- No commented-out code, no TODO without an owner and a graph node or follow-up entry in
  `docs/STATE.md`.
- English only; no mention of AI tools anywhere in code or comments (AI usage is documented in
  `AI-USAGE.md`).

## 9. Tests

- Vitest. Targeted tests only (X-4): pure logic (reducers, totals, throttle, contract guards) and
  the bridge client behaviour. No snapshot tests, no tests of styling.
- Test names read as behaviour: `it('queues a command sent before VIEWER_READY and flushes it in order')`.
- Arrange / act / assert with blank lines between; one behaviour per test; assert on state or on
  calls (`vi.fn()`), not on implementation details.
- Reference equality (`toBe`) is used to assert "nothing changed" in reducers.
- A bug fix comes with the test that would have caught it.

## 10. Git and review

- Conventional Commits, English, no trailers, no AI mentions (CLAUDE.md §4).
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
