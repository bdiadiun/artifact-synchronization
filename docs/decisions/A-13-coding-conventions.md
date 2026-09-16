# A-13 — Coding conventions, lint enforcement and agent roles

Status: approved 2026-09-16. Canon: Q-7, D-3, section 10 ("code quality": typing, effect cleanup, structure, readability).

## Context
Slices 1–11 were written by several assistant sessions from briefs that named the canon and the
files in scope but no shared style. The result is consistent in structure but mixed in idiom:
`function` declarations next to arrows, string-literal action types, oxlint from the Vite template
that cannot enforce naming or function style.

## Decision
- One style document, `docs/CONVENTIONS.md`, is the source of truth; every agent brief points to it.
- Functions: arrow functions everywhere (components, hooks, utilities, handlers); `function`
  declarations only where hoisting is genuinely required, with a comment.
- Enums: string enums for application state (row status, reducer action types, UI modes); numeric
  enums are forbidden. The wire contract in `packages/contract` keeps string-literal union types:
  it is the serialised format, copied into the OHIF fork, and literal types are the
  recommendation of typescript-eslint and the Google TypeScript style guide for such boundaries.
- Tooling: ESLint 9 flat config with `typescript-eslint` `strict-type-checked` and
  `stylistic-type-checked`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
  Prettier for formatting; oxlint removed. `npm run lint` and `npm run format:check` must pass with
  zero warnings before a slice reaches gate 2.
- Agent roles live in `.claude/agents/` (architect, developer, tester, git-operator, researcher)
  with model, tools and a prompt that embeds the brief template and the conventions.

## Rejected alternatives
- Google/Airbnb hybrid (`function` for top-level names): equally valid, but the author prefers a
  single arrow style and it is simpler to enforce.
- Enums in the contract too: consistent, but couples the wire format to a TypeScript-only
  construct and diverges from the typescript-eslint recommendation.
- `as const` objects instead of enums: the TypeScript team's advice, rejected by the author in
  favour of enum readability for internal state.

## Consequences
- Slice 13 refactors existing code to the conventions; lint is allowed to be red only in the PR
  that introduces the rules.
- The fork extension follows the same document; its lint runs through OHIF's own ESLint config,
  so the conventions there are checked by review plus Prettier.
