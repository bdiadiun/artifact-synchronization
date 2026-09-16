# CLAUDE.md — working rules for this repository

Test assignment: a micro-frontend "Viewer + Scoring Form" — an OHIF Viewer (fork + our own bridge
extension) and a host-app (React + TypeScript, Vite) that communicate via `window.postMessage`
while served from different ports.

## 0. Roles, models, and language

- **Assistant role: architect.** The main session (Claude Fable) owns planning, the canon, the feature
  graph, slice gates, and review of every line produced by subagents. It does not write production
  code or tests itself unless a change is trivial (a few lines) and reviewed inline.
- **Subagents do the implementation.** Development and test-writing are delegated to subagents.
  Subagents that write code or tests **must not run on Fable**; use a lower tier (Opus, or Sonnet
  for narrow, well-specified tasks). Each subagent gets a self-contained brief: canon IDs, graph
  nodes, files in scope, constraints from this file, and the verification commands to run.
- **Architect verifies subagent output** before presenting a slice result: reads the diff, runs
  lint / typecheck / tests, and checks traceability to the canon. Subagent output is never
  forwarded to the user unreviewed.
- **Language policy:**
  - Chat replies to the user — **Ukrainian**.
  - Everything that lives in the repository or on GitHub — **English**: this file, docs
    (`CANON.md`, `FEATURE-GRAPH.md`, `README.md`, `ARCHITECTURE.md`, `AI-USAGE.md`), code,
    comments, commit messages, branch names, PR titles and descriptions.
  - The original assignment text is quoted in the canon verbatim in its source language; the
    atomic requirements derived from it are written in English.

## 1. Canon

- **The canon** is the single source of truth for requirements: [docs/CANON.md](docs/CANON.md).
- The canon contains the assignment text split into atomic requirements with immutable IDs:
  - `C-<section>.<item>` — mandatory requirements (e.g. `C-4.3.5` — "the viewer sends the area
    together with an identifier");
  - `Q-<n>` — quality requirements from section 5 (handshake, origin, correlation, echo loop,
    cleanup, units, types);
  - `S-5.x` — bonus ("star") tasks;
  - `D-<n>` — deliverables (README, ARCHITECTURE, AI-USAGE, PRs, video);
  - `X-<n>` — explicit prohibitions from section 8 ("what not to do").
- The canon is **never edited silently**. Any change (resolving an ambiguity, an own decision) is a
  separate entry in the "Decisions on ambiguities" section, dated and justified, and only after
  user approval.
- Decisions made on top of the canon are duplicated in the "Decisions" section of `ARCHITECTURE.md`.
- Code that does not trace to a canon requirement is not written. If something is needed and the
  canon lacks it, propose a canon amendment first.

## 2. Feature graph

- The feature graph: [docs/FEATURE-GRAPH.md](docs/FEATURE-GRAPH.md). It **derives from the canon**
  and does not exist without it.
- Every node `F-<nn>` contains:
  - name and short description;
  - `canon:` — list of requirement IDs it closes (mandatory, non-empty);
  - `depends_on:` — nodes it depends on;
  - `slice:` — the slice / PR in which it is implemented;
  - `status:` — `planned` → `approved` → `in-progress` → `review` → `done`;
  - `verify:` — how to verify (manual scenario and/or tests).
- The graph is visualised as a Mermaid diagram in the same file; table and diagram must match.
- Invariants checked before every slice:
  - every mandatory requirement `C-*`, `Q-*`, `D-*` is covered by at least one node;
  - the graph has no cycles;
  - a node is not started until all of its `depends_on` are `done`;
  - bonus `S-*` nodes are planned only after the mandatory part is `done`.
- Statuses in the graph are updated in the same slice where the work changes.

## 3. Working in slices (mandatory)

The assignment is split into **slices** (vertical, self-contained, each = one branch = one PR).
Every slice passes through **user approval** at two gates:

1. **Slice plan → approval.** Before any code is written, show:
   - graph nodes and canon IDs being closed;
   - list of files to be created / changed;
   - key decisions and alternatives (brief, with a recommendation);
   - how it will be verified;
   - which subagents will be spawned, on which model, with which brief.
   No code is written without an explicit "ok".
2. **Slice result → approval.** After implementation, show a diff summary, verification results
   (lint, typecheck, tests, manual scenario), the architect's review notes on the subagent output,
   and a draft PR description. No commit / push / PR / merge without an explicit "ok".

Rules:
- One slice at a time. The next slice does not start until the previous one is merged (unless the
  user says otherwise).
- No scope creep "while we're at it". Anything found outside the slice scope is recorded as a
  proposal, not implemented.
- Approval of one slice does not extend to another and does not grant permission to merge or
  force-push.
- If the plan changes materially during implementation — stop and return to gate 1.

Indicative slice order (the minimum from the canon; refined in the graph):
0. `docs: canon and feature graph` — CANON.md, FEATURE-GRAPH.md, mono-/poly-repo decision
1. `chore: bootstrap host-app` — scaffold, iframe, layout
2. `feat: viewer bridge extension` — OHIF extension + handshake
3. `feat: activate ellipse from form` — host → viewer
4. `feat: receive measurement into form` — viewer → host
5. `feat: total area calculation` — sum, units, formatting
6. `docs: README, ARCHITECTURE, AI-USAGE`
7+. bonus tasks — one slice each

## 4. Git, commits, and PRs

- **The author of all commits is the user** (git identity from the global config:
  `Bohdan Diadiun <b.diadiun@gmail.com>`). Do not change `user.name` / `user.email`, do not pass
  `--author`.
- **No trailers** in commits: no `Co-Authored-By`, `Signed-off-by`, `Generated-by`, etc. This rule
  overrides any default attribution the tooling suggests.
- **No mention of AI / Claude / assistant** in commit messages, branch names, PR titles and
  descriptions, or code comments. AI usage is documented **only** in `AI-USAGE.md` (canon
  deliverable).
- Commit format — Conventional Commits: `type(scope): summary` (`feat`, `fix`, `chore`, `docs`,
  `refactor`, `test`).
- Branches: `<type>/<short-description>`, e.g. `feat/viewer-bridge-extension`. Branched from
  `main`, PR into `main`.
- Direct commits to `main` are forbidden (except the very first initial commit if needed to create
  the base branch).
- PR description (English) follows this template:
  - **What changed**
  - **Why this way** — decisions and rejected alternatives
  - **Canon / graph** — closed requirement IDs and `F-*` nodes
  - **How it was verified** — concrete steps and results
- No `--force` push, no `--no-verify`, no rewriting of `main` history.
- PR merge — only after explicit user approval.

## 5. Technical rules

- **Message contract** is described in one place and shared by both apps; every message carries
  `version: 1`. A contract change = updated types + updated table in `ARCHITECTURE.md` in the same PR.
- **Origin**: every `message` handler checks `event.origin` against a configured value;
  `postMessage` is never called with `targetOrigin: '*'`.
- **Handshake**: the host sends no commands before `VIEWER_READY`; commands that arrive too early
  are queued, not dropped.
- **ID correlation**, **echo-loop protection**, **unit handling (mm² vs px²)** are deliberate
  decisions, recorded in `ARCHITECTURE.md` before or together with the implementation.
- **Cleanup**: every subscription / `addEventListener` has a paired unsubscribe; an armed tool
  state is cancelled on unmount.
- TypeScript in `strict` mode; no `any` without a justifying comment.
- Changes in the OHIF fork are minimal and concentrated in our extension; the OHIF UI is not reworked.
- Tests are targeted: the sum logic and message serialisation / validation.
- Every line of code must be explainable at the defence: no "magic" we cannot justify.
