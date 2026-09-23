# Project structure

Two reference layouts and how this repository applies them: the anatomy of a `.claude/` folder, and
the conventional folder structure of a React (Vite) application. Where the reference and this
repository differ, the reason is stated; where the reference lists something that is not a real
feature, that is stated too.

## 1. The `.claude/` folder

Reference layout, with what each entry does:

```
your-project/
├── CLAUDE.md               the rules for this repository, kept short
├── CLAUDE.local.md         personal overrides, never committed
├── .gitignore              blocks *.local.* and secrets
├── .mcp.json               MCP servers, project root only, no nesting
└── .claude/
    ├── skills/             model-invokable procedures; Claude picks them up itself
    ├── agents/             subagents, each with its own context window
    ├── commands/           slash commands, legacy but working
    ├── rules/              instructions scoped to a path glob, loaded on match
    ├── output-styles/      the shape of the answer, swappable
    ├── settings.json       permissions, model, hook registry
    └── settings.local.json this machine only, gitignored
```

Two entries from the reference are **not** real features and are deliberately absent here:

| Reference entry                               | Reality                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/hooks/` as a folder of shell scripts | Hooks are a `hooks` key in `settings.json` with an event, a matcher and a command. The script itself can live anywhere; ours is `scripts/hooks/format-touched.mjs`. |
| `.claude/plugins/`                            | A plugin is a standalone directory with its own manifest, or something installed from a marketplace. A project folder of that name means nothing.                   |

`commands/` still works but is the older form of `skills/`; both are used here, see below.

### What this repository has

| Path                               | Purpose                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                        | How the work is run: roles, canon, feature graph, slices and gates, git rules, technical rules.                               |
| `.claude/agents/`                  | `architect`, `developer`, `tester`, `researcher`, `git-operator` — model, tools and prompt per role.                          |
| `.claude/skills/slice/SKILL.md`    | The slice procedure: the two gates, delegation, verification, closing a node.                                                 |
| `.claude/skills/handover/SKILL.md` | How a role hands its work to a fresh instance of itself when its context fills up.                                            |
| `.claude/commands/`                | `/verify` (the CI set in order), `/e2e` (both apps plus a browser scenario), `/close-node` (graph bookkeeping after a merge). |
| `.claude/rules/`                   | Path-scoped rules: `host-app.md`, `fork.md`, `contract.md`, each loaded when a file under its globs is touched.               |
| `.claude/settings.json`            | Permission allow and deny lists, and the hook that formats a file right after it is written.                                  |
| `.gitignore`                       | Ignores `.claude/settings.local.json` and `CLAUDE.local.md`, which are personal.                                              |

## 2. The React (Vite) application

Reference layout:

```
my-react-app/
├── node_modules/     dependencies
├── public/           static files copied as is
├── src/
│   ├── assets/       images, fonts, icons
│   ├── components/   reusable UI components
│   ├── pages/        page-level components
│   ├── hooks/        custom React hooks
│   ├── context/      React context providers
│   ├── redux/        store and slices
│   ├── utils/        helper functions
│   ├── App.tsx       the root component
│   ├── main.tsx      the entry point
│   └── index.css     global styles
├── .gitignore
├── package.json
├── README.md
└── vite.config.ts
```

`host-app` follows it, with one departure recorded in A-27: there is no `utils/` folder, and the
folders it does not need yet do not exist.

- **`App.tsx` is not there**: with one page there is nothing to compose, so `main.tsx` renders
  `ScoringPage` directly; an `App` would be a one-line wrapper.

- **A folder appears when its first file does.** This project has no images, no context provider and
  no store, so `assets/`, `context/` and `redux/` do not exist on disk. The names above are the
  convention: whoever adds the first image creates `assets/`, whoever needs a provider creates
  `context/`, and so on. A folder kept alive by a placeholder file says nothing true about the code.

- **Two folders the reference does not name, `state/` and `services/`, are the conventional names
  for what a Redux-less React app still has: a reducer with its selectors and actions, and the two
  modules that talk to the outside (the channel, `sessionStorage`). Nothing is invented: a reader
  from any React project finds each thing where they would look for it (A-27).

| Folder            | What is in it here                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/assets/`     | Not created yet: the form uses native elements and no imagery (canon X-3).                                                                                                                                                                              |
| `src/components/` | `ViewerFrame`, `ScoringPanel`, `MeasurementRow`, `TotalsFooter`, `BridgeStatus`, each with its `.props.ts`; `ScoringPanel` owns the form (it calls `useScoringForm`) and shows the bridge status; the others render what they are given.                |
| `src/pages/`      | `ScoringPage` — the single page, layout only: the viewer iframe on the left, the panel on the right.                                                                                                                                                    |
| `src/context/`    | Not created yet: the form's state lives in one reducer and is passed as props.                                                                                                                                                                          |
| `src/redux/`      | Not created yet: there is no store; `useReducer` holds the rows.                                                                                                                                                                                        |
| `src/utils/`      | `format` (values, statuses, kinds) and `totals` (per-unit sums): pure helpers over the row model.                                                                                                                                                       |
| `src/hooks/`      | `useChannel()` (the channel's `{ ready, queued, announcements }`) and `useScoringForm(studyInstanceUid)` (`[rows, dispatch]`: the reducer read from storage, the viewer's events dispatched to it, the stored rows offered back on every announcement). |
| `src/state/`      | `reducer` (`Row`, `RowStatus`, `FormAction`, the pure reducer), `selectors` (`findRow`, `findRowByUid`, `findDrawingRow`), `actions` (what each button does to its row, and `restoreViewer`).                                                           |
| `src/services/`   | `channel` (the page's one channel instance) and `storage` (the stored-row schema and one sessionStorage key per study).                                                                                                                                 |
| `src/i18n.ts`     | Every user-visible string as `t.<key>`, Ukrainian per decision A-7.                                                                                                                                                                                     |

Outside `host-app`, the repository keeps the packages, each laid out by side or role (A-27):
`packages/contract` (the wire contract, four flat files), `packages/channel` (two files: `channel.ts`,
`peer.ts`), `packages/viewer-bridge` (`commands/`, `events/`, `ohif/`), `packages/viewer-adapter`;
then `viewer/` (the OHIF fork, a local checkout pinned by `viewer.json` and ignored by git),
`scripts/` (checks and generators) and `docs/` (canon, graph, decisions, notes). `ARCHITECTURE.md`
maps every concern to the file that owns it.

## 3. Rules that follow from this

- A new component goes to `components/` with its `.props.ts`; a new page to `pages/`; a hook to
  `hooks/`; a helper beside the module it serves, never to a `utils/` folder (A-27). A folder the layout names but the repository does not have yet is created when its
  first file arrives, under that exact name.
- Tests live in a `__tests__/` folder inside the folder of the code under test.
- Instructions that apply only to one part of the repository belong in `.claude/rules/` with a
  `paths` glob, not in `CLAUDE.md`, which stays short.
- A repeated manual procedure becomes a command in `.claude/commands/`; a procedure with judgement
  in it becomes a skill in `.claude/skills/`.
