# Canon — requirements of the test assignment

This file is the single source of truth for requirements. IDs are immutable. The original
assignment text (Ukrainian) is quoted verbatim in Appendix A; the atomic requirements below are
derived from it. Any deviation or resolved ambiguity is recorded in section "Decisions on
ambiguities" only, and only after approval.

ID classes:

| Prefix      | Meaning                                                                     | Source section                 |
| ----------- | --------------------------------------------------------------------------- | ------------------------------ |
| `C-<s>.<i>` | Mandatory functional / architectural requirement                            | 3, 4                           |
| `Q-<n>`     | Quality requirement, graded separately                                      | 5                              |
| `S-5.<n>`   | Bonus ("star") task, optional                                               | 6 (numbered 5.x in the source) |
| `D-<n>`     | Deliverable / submission artifact                                           | 7                              |
| `X-<n>`     | Explicit prohibition ("do not do")                                          | 8                              |
| `P-<n>`     | Defence-readiness item: a question or live change we must be able to handle | 9                              |

## 1. Purpose (informative)

The assignment reproduces a daily situation: two independent apps on different ports talk to each
other. A medical image viewer (OHIF) on one side, a scoring form on the other. The form does not
draw annotations; it asks the viewer to enable a tool and receives the result back. What is
evaluated: message contract design, asynchrony (who loads first, early messages), entity-to-
annotation correlation and sync, and infinite-loop avoidance. AI use is allowed and expected, but
the code must be defended by the author.

## 3. Architecture (mandatory)

| ID    | Requirement                                                                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-3.1 | Two applications on two different ports communicate exclusively through `window.postMessage`.                                                                                                                                                                                               |
| C-3.2 | `viewer` is a fork of https://github.com/OHIF/Viewers, run locally, extended with our own OHIF extension that acts as a bridge: accepts commands from outside and publishes events to the outside.                                                                                          |
| C-3.3 | `host-app` is a new React application built from scratch on any boilerplate (Vite recommended). It contains an `<iframe>` with the viewer and the form.                                                                                                                                     |
| C-3.4 | The bridge lives inside our extension: it obtains `servicesManager` and `commandsManager` in the `preRegistration` hook, subscribes to `measurementService` there and calls `commandsManager.runCommand(...)`. Do not try to reach OHIF internals through `window` from outside the iframe. |

## 4. Mandatory part

### 4.1 Running the viewer

| ID      | Requirement                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| C-4.1.1 | Fork https://github.com/OHIF/Viewers and run it locally.                                                                                     |
| C-4.1.2 | Data source is the public DICOMweb that OHIF ships with by default; no own PACS.                                                             |
| C-4.1.3 | The viewer must open by a direct link to a specific study (`/viewer?StudyInstanceUIDs=...`), because exactly that link goes into the iframe. |

### 4.2 Host-app and page

| ID      | Requirement                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------ |
| C-4.2.1 | Host-app is React + TypeScript.                                                                  |
| C-4.2.2 | Single page: on the left the viewer iframe (flexible, full height), on the right the form panel. |
| C-4.2.3 | The two apps run on different ports, deliberately, so that real cross-origin constraints apply.  |

### 4.3 Scenario "add measurement" (core)

| ID      | Requirement                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| C-4.3.1 | The form has an "Add measurement" button.                                                                                                |
| C-4.3.2 | Clicking it creates a new empty row in the form with status `Pending` and an "Activate" button.                                          |
| C-4.3.3 | Clicking "Activate" sends a command into the iframe to enable the Ellipse tool (`EllipticalROI`). The row switches to status `Drawing…`. |
| C-4.3.4 | The user draws an ellipse in the viewer.                                                                                                 |
| C-4.3.5 | The viewer sends back the annotation area together with an identifier by which the host understands which row the value belongs to.      |
| C-4.3.6 | The row receives the value (e.g. `124.5 mm²`), status `Done`; the tool in the viewer deactivates by itself (returns to Pan / default).   |
| C-4.3.7 | Steps C-4.3.1–C-4.3.6 are repeatable; there may be any number of rows.                                                                   |
| C-4.3.8 | At the bottom of the form there is the sum of the areas of all rows, recalculated automatically.                                         |

### 4.4 Minimal message contract

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-4.4.1 | Event names are fixed: `VIEWER_READY` (viewer → host, viewer loaded and ready for commands); `ACTIVATE_TOOL` (host → viewer, enable a tool for a specific form row); `DEACTIVATE_TOOL` (host → viewer, cancel waiting for drawing); `MEASUREMENT_ADDED` (viewer → host, annotation created: value + units + binding); `MEASUREMENT_UPDATED` (viewer → host, annotation changed; see S-5.1). |
| C-4.4.2 | Payload structure is designed by us and described in `ARCHITECTURE.md`.                                                                                                                                                                                                                                                                                                                     |
| C-4.4.3 | Every message carries a contract version (`version: 1`); the reason is explained at the defence.                                                                                                                                                                                                                                                                                            |

## 5. Quality requirements (graded separately, one line each)

| ID  | Requirement                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-1 | **Handshake.** The host must not send commands before the viewer has reported `VIEWER_READY`. If the user clicks "Activate" while the iframe is still loading, the command must not be lost.                                       |
| Q-2 | **Origin check.** `message` handlers on both sides check `event.origin` and ignore foreign origins. A hardcoded origin in config is fine; its absence is not.                                                                      |
| Q-3 | **Correlation.** Every form row has its own identifier, every annotation has its own. We must consciously decide who issues which ID and how the mapping is maintained. This is the main architectural decision of the assignment. |
| Q-4 | **No echo loop.** If S-5.1 is implemented, an update host → viewer → host must not produce an infinite ping-pong. This will be tested.                                                                                             |
| Q-5 | **Cleanup.** `removeEventListener`, unsubscribing from `measurementService`, cancelling the "armed" state on unmount.                                                                                                              |
| Q-6 | **Units.** Area may arrive in mm² or px² depending on whether the DICOM has pixel spacing. Units must not be lost and mm² must not be added to px² in the sum. The handling must be described.                                     |
| Q-7 | **TypeScript.** Message types are declared in one place and shared by both apps (separate package, shared folder, or at least a copied file with an explanation why).                                                              |

## 6. Bonus tasks (optional; source numbers them 5.x)

| ID    | Requirement                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-5.1 | **Live update.** Dragging an ellipse handle updates the value in the form in real time; the sum is recalculated.                                                                             |
| S-5.2 | **Deletion.** A "Delete" button in a form row removes the annotation in the viewer, and deleting the annotation in the viewer clears the row.                                                |
| S-5.3 | **Focus.** Clicking a form row highlights / scrolls to the matching annotation in the viewer.                                                                                                |
| S-5.4 | **Second tool.** Add a row type "Length" (`Length` tool); the sum of lengths is computed separately from the sum of areas.                                                                   |
| S-5.5 | **Version on the viewport.** Show the OHIF version (from `package.json`, injected at build time through bundler config) in a corner of every viewport; in a 2×2 grid it appears on all four. |
| S-5.6 | **State restore.** After a page reload the form and the annotations are restored.                                                                                                            |

## 7. Submission format

| ID  | Requirement                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | Code in a public repository (GitHub / GitLab). OHIF fork + host-app may be two repositories or a mono-repo; the choice must be explained.                                                                                                                             |
| D-2 | Work is split into feature pull requests, at least five, indicatively: `chore: bootstrap host-app`, `feat: viewer bridge extension`, `feat: activate ellipse from form`, `feat: receive measurement into form`, `feat: total area calculation`.                       |
| D-3 | Every PR has a meaningful description: what changed, why this way, what was verified. A PR described as "changes" does not count.                                                                                                                                     |
| D-4 | PRs may be merged by the author; no external code review at this stage. The history of thinking matters.                                                                                                                                                              |
| D-5 | `README.md`: how to run both apps from scratch (git clone → working screen). It will be executed literally on a clean machine.                                                                                                                                        |
| D-6 | `ARCHITECTURE.md`: exchange diagram, full message table with payloads, and a separate "Decisions" section: who issues IDs, how the handshake works, what happens to early commands, how the echo loop is avoided. 1–2 pages, to the point.                            |
| D-7 | `AI-USAGE.md`: honestly, where AI was used, what output was kept as is, what was rewritten and why.                                                                                                                                                                   |
| D-8 | Video demo, 2–4 minutes, voice-over preferred, showing: (a) both apps starting; (b) at least three measurements added in a row; (c) the sum updating; (d) behaviour on cancelled activation ("Activate" clicked, then changed mind); (e) any implemented bonus tasks. |

## 8. What not to do

| ID  | Prohibition                                                                                     |
| --- | ----------------------------------------------------------------------------------------------- |
| X-1 | No auth, backend, database, or server-side persistence.                                         |
| X-2 | No own PACS / DICOMweb server.                                                                  |
| X-3 | No design work; a grey form with native inputs is enough.                                       |
| X-4 | No project-wide tests. A few unit tests for the sum logic and message serialisation are enough. |
| X-5 | No rework of the OHIF UI itself (panels, toolbar) beyond what the bridge requires.              |

## 9. Defence readiness

Questions we must be able to answer with a pointer into the code:

| ID  | Item                                                                                               |
| --- | -------------------------------------------------------------------------------------------------- |
| P-1 | What happens if the iframe loads slower than the user clicks the button? Show where it is handled. |
| P-2 | Why `postMessage` and not another mechanism? What would change if both apps shared one origin?     |
| P-3 | Who issues the measurement identifier and why? What breaks if the decision is flipped?             |
| P-4 | Where exactly in OHIF do we subscribe to annotation creation and why there?                        |
| P-5 | What happens if two host-app tabs are open at the same time?                                       |
| P-6 | Show the place where an infinite message loop could arise.                                         |

Live changes (~10 min each) the design must make cheap:

| ID  | Item                                                                                                  | Design implication                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| P-7 | Replace the tool: ellipse → `RectangleROI`.                                                           | Tool name is a single configurable constant carried in the `ACTIVATE_TOOL` payload, not scattered.             |
| P-8 | Add one more field to the row (e.g. perimeter or mean intensity) and pass it through the whole chain. | Measurement payload and row model are extensible; the mapping viewer-measurement → payload is in one function. |
| P-9 | One protocol element is disabled (e.g. `VIEWER_READY`); diagnose the breakage aloud.                  | Bridge logs / dev-visible state make the handshake and queue observable.                                       |

## 10. Grading (informative)

Working scenario 25 %, bridge architecture 25 %, defence 25 %, code quality 15 %, communication
10 %. Bonus tasks add up to +15 % but do not compensate a failed defence.

## Decisions on ambiguities

This table is the index. Each decision has a full record (context, decision, rejected alternatives, consequences) in [`docs/decisions/`](decisions/). Approved decisions are also mirrored in `ARCHITECTURE.md` → "Decisions".

| #                                                         | Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rationale                                                                                                                                                                                                                                                     | Status                |
| --------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| [A-1](decisions/A-1-mono-repo-with-submodule.md)          | 2026-09-16 | Mono-repo: `host-app/` in this repository, the OHIF fork as a git submodule under `viewer/` pointing to our fork.                                                                                                                                                                                                                                                                                                                                                                                     | One PR can change both sides of the contract; the fork keeps its own history and stays a real fork (C-4.1.1, D-1). Vendoring OHIF would bloat the repo.                                                                                                       | approved 2026-09-16   |
| [A-2](decisions/A-2-ports.md)                             | 2026-09-16 | Ports: host-app `5173`, viewer `3000`. Both are fixed in config and used for origin checks (Q-2).                                                                                                                                                                                                                                                                                                                                                                                                     | Vite and OHIF defaults; distinct ports satisfy C-4.2.3.                                                                                                                                                                                                       | approved 2026-09-16   |
| [A-3](decisions/A-3-defence-readiness-ids.md)             | 2026-09-16 | Added the `P-*` ID class for section 9 (defence readiness). These items are not requirements but constrain design; graph nodes may reference them in addition to a `C/Q/D` ID.                                                                                                                                                                                                                                                                                                                        | Live changes (P-7..P-9) affect how the contract and row model are shaped; tracking them avoids a costly refactor at the defence.                                                                                                                              | approved 2026-09-16   |
| [A-4](decisions/A-4-cancelled-activation.md)              | 2026-09-16 | "Cancelled activation" (D-8 d) maps to `DEACTIVATE_TOOL`: the row returns from `Drawing…` to `Pending`, the viewer returns to the default tool, and the row is kept.                                                                                                                                                                                                                                                                                                                                  | The assignment names the event but not the row behaviour; keeping the row is the least surprising outcome.                                                                                                                                                    | approved 2026-09-16   |
| [A-5](decisions/A-5-deferred-bridge-decisions.md)         | 2026-09-16 | Decisions on ID issuance (Q-3), early-command queue (Q-1), echo-loop protection (Q-4) and mixed-unit sums (Q-6) are taken in the slice that implements them and recorded here plus in `ARCHITECTURE.md` in the same PR.                                                                                                                                                                                                                                                                               | They need contact with the real OHIF `measurementService` API to be made responsibly.                                                                                                                                                                         | resolved by A-8..A-11 |
| [A-6](decisions/A-6-ohif-base-version.md)                 | 2026-09-16 | The OHIF fork branch is based on the release tag `v3.12.17`, not on `master`.                                                                                                                                                                                                                                                                                                                                                                                                                         | `master` requires Node >= 24 and pnpm 11; `v3.12.17` requires Node >= 18 and yarn 1, matching the local toolchain and giving a stable base for the README "clean machine" run (D-5).                                                                          | approved 2026-09-16   |
| [A-7](decisions/A-7-ui-language.md)                       | 2026-09-16 | User-visible strings of the form are Ukrainian, as in the assignment, collected in one file (`host-app/src/i18n.ts`); code, comments and docs stay English.                                                                                                                                                                                                                                                                                                                                           | The reviewer expects the screen from the assignment ("Додати вимірювання", "Разом"); one strings file keeps the English-code rule intact.                                                                                                                     | approved 2026-09-16   |
| [A-8](decisions/A-8-id-correlation.md)                    | 2026-09-16 | Host issues `rowId`; viewer issues `measurementUid` (cornerstone `annotationUID`); both sides keep a `rowId ↔ measurementUid` map. After a measurement or a cancel the bridge restores the previously active primary tool (snapshot via `toolGroupService.getActivePrimaryMouseButtonTool()`), which is the assignment's "Pan/default".                                                                                                                                                               | OHIF's `_isValidMeasurement` rejects custom fields, so an external ID cannot ride on the measurement; `uid` is stable across ADDED/UPDATED/REMOVED. Default primary tool in longitudinal mode is WindowLevel, not Pan.                                        | approved 2026-09-16   |
| [A-9](decisions/A-9-handshake-and-queue.md)               | 2026-09-16 | Host keeps `ready` + a FIFO command queue; commands before `VIEWER_READY` are queued and flushed in order without coalescing. A repeated `VIEWER_READY` (iframe reload) resets `ready` and re-arms the row currently in `Drawing…`.                                                                                                                                                                                                                                                                   | Simple, observable, and answers P-1 / P-9 directly.                                                                                                                                                                                                           | approved 2026-09-16   |
| [A-10](decisions/A-10-echo-guard.md)                      | 2026-09-16 | Mandatory part: host never writes back to the viewer in reaction to `MEASUREMENT_*`, so no loop by construction. Bonus tasks: every host command carries `requestId`; viewer events caused by a command carry `causedBy`; host ignores its own `causedBy` and applies commands idempotently (no command when state already matches).                                                                                                                                                                  | `measurementService.update/remove` re-broadcast events; this is the loop point (P-6).                                                                                                                                                                         | approved 2026-09-16   |
| [A-11](decisions/A-11-units-and-metrics-payload.md)       | 2026-09-16 | Units are copied from OHIF `cachedStats` as is (`mm2` / `px2`), never inferred. Payload carries `metrics: { area: { value, unit } }`; sums are computed per unit and never mixed.                                                                                                                                                                                                                                                                                                                     | Extensible for P-8 (add a key, not a type change); satisfies Q-6.                                                                                                                                                                                             | approved 2026-09-16   |
| [A-12](decisions/A-12-npm-workspaces.md)                  | 2026-09-16 | npm workspaces for `host-app` and `packages/contract` (`@scoring/contract`); the viewer submodule stays outside. Superseded in part by A-15: the contract is now a published package and the copy is gone.                                                                                                                                                                                                                                                                                            | Explicit package dependency instead of an alias; the fork must stay a self-contained yarn repo.                                                                                                                                                               | approved 2026-09-16   |
| [A-13](decisions/A-13-coding-conventions.md)              | 2026-09-16 | Coding conventions in `docs/CONVENTIONS.md`: arrow functions everywhere; string enums for app state, literal types in the wire contract; ESLint 9 + typescript-eslint strict + Prettier; agent roles in `.claude/agents/`.                                                                                                                                                                                                                                                                            | Consistent, mechanically enforced style for the "code quality" grading block; separates the serialised contract from TypeScript-only constructs.                                                                                                              | approved 2026-09-16   |
| [A-14](decisions/A-14-state-restore.md)                   | 2026-09-18 | State restore (S-5.6): the form persists rows and annotation geometry in `sessionStorage` per study and asks the viewer to rebuild the annotations with their original uids after `VIEWPORT_DATA_CHANGED`; values are confirmed by the recomputed `MEASUREMENT_UPDATED`, and rows that could not be rebuilt are marked.                                                                                                                                                                               | The uid survives `addAnnotation`, so correlation holds; per-tab storage keeps the two-tab answer (P-5); trusting the stored number without an annotation behind it would be dishonest.                                                                        | approved 2026-09-18   |
| [A-15](decisions/A-15-publish-contract-package.md)        | 2026-09-18 | The contract is published to the public npm registry as `@bdiadiun/scoring-contract`, exports the guards and the tool-to-metric map both sides were re-implementing, and requires a world point to be exactly three coordinates; the fork's copy is removed once the first version is published.                                                                                                                                                                                                      | Public npm reads without a token, so the reviewer's clone stays token-free while the format gains one owner and an explicit version; the re-implemented guards had already drifted.                                                                           | approved 2026-09-18   |
| [A-16](decisions/A-16-adapter-and-viewer-delivery.md)     | 2026-09-20 | The bridge extension is an adapter: a registry maps a command type to its handler, completeness is enforced against the contract's union at compile time, and the fork's diff stays frozen at the registration entry, the dependency line and the workflow. The viewer is delivered by deployment, not as an npm package.                                                                                                                                                                             | OHIF resolves commands and customizations at call time, so the adapter can grow without touching the fork; the built viewer is a 199 MB application bundle whose manifest points at a file the build never produces, so it is not consumable as a dependency. | approved 2026-09-20   |
| [A-17](decisions/A-17-orchestrator-package.md)            | 2026-09-20 | The client half of the channel becomes the published package `@bdiadiun/scoring-orchestrator`: handshake, queue, origin checks, listeners and command builders. The React binding stays in the form, and a viewer is addressed by configuration.                                                                                                                                                                                                                                                      | The viewer is a deployed application and there may be several at different versions, while the piece that talks to them is one; the channel's safety rules then live in one tested place instead of being copied by the next host.                            | approved 2026-09-20   |
| [A-18](decisions/A-18-viewer-checked-out-not-vendored.md) | 2026-09-20 | The OHIF fork stops being a submodule. `viewer/` becomes a local checkout, ignored by git, cloned at an exact pinned commit by `npm run viewer:setup`. The fork itself stays on GitHub and remains the answer to C-3.2.                                                                                                                                                                                                                                                                               | The reasons for vendoring expired once the contract and the channel became published packages and the fork's diff froze; a pinned clone reproduces just as exactly without putting a hundred thousand foreign files in the way of everyday work.              | approved 2026-09-20   |
| [A-19](decisions/A-19-study-from-the-page-url.md)         | 2026-09-21 | Our own addition, not a requirement: the form reads a `study` parameter from its own URL, accepts it only if it looks like a DICOM identifier, encodes it into the viewer's URL and falls back to the previous constant.                                                                                                                                                                                                                                                                              | The value is the one piece of outside input the form puts into a URL, so it gets both defences, validation and encoding; and the per-study storage key finally means something.                                                                               | approved 2026-09-21   |
| [A-20](decisions/A-20-three-layers.md)                    | 2026-09-21 | Three layers: the fork holds one registration entry and changes only when OHIF does; a published adapter registers our extensions through the extension manager in `preRegistration`; the extensions are packages the adapter depends on. Command names are prefixed per package, and we describe only the twelve OHIF members we call.                                                                                                                                                               | An extension may register other extensions at v3.12.17, which separates OHIF's release schedule from ours; the alternative of supplying the adapter by deployment configuration was rejected because it duplicates React and moves failures into the browser. | approved 2026-09-21   |
| [A-21](decisions/A-21-channel-and-exchange.md)            | 2026-09-21 | One package holds the channel both sides use: the origin check, the guard and the explicit target origin, with a generic `send`, `on` and `exchange` whose payload types follow from the message type. The contract gains the table of which event answers which command, and an answer that never arrives becomes an error rather than an unbounded wait.                                                                                                                                            | The security rules are implemented and tested once instead of twice; a method per message would be ceremony and a place to forget a field, while the typed pair cannot drift from the contract.                                                               | approved 2026-09-21   |
| [A-22](decisions/A-22-one-channel-api.md)                 | 2026-09-22 | One channel API for both ends: the channel owns the post, the queue until the peer's ready message and the observable state; both applications register one handler map with `onEach`; an event goes channel → handler → reducer and `lastEvent` is gone; `@bdiadiun/scoring-orchestrator` is no longer released (supersedes A-17 and the registry part of A-16). The form keeps its reducer.                                                                                                         | approved 2026-09-22                                                                                                                                                                                                                                           |
| [A-23](decisions/A-23-minimal-bridge.md)                  | 2026-09-22 | A minimal bridge: the viewer extension keeps only what is about OHIF (tool activation, `cachedStats` → metrics, annotation restore); announcing readiness, the armed row and `reply(command, …)` move into the channel's viewer end; the previous-tool snapshot, the ADDED correction timer, the `uid → rowId` gating and the de-duplication sets are removed; after a measurement the viewer returns to the fixed default tool. `ArmedRow` joins the contract (moved to the viewer channel in A-27). | approved 2026-09-22                                                                                                                                                                                                                                           |
| [A-24](decisions/A-24-plain-code.md)                      | 2026-09-22 | Plain code: each channel end is written on its own with concrete types and three shared helpers; no type exists only to make a signature type-check; guards are named functions with an exhaustive `switch`; a comment says only what the code cannot, under 10% of a package's lines. Readability outranks reuse at the seam between the two ends.                                                                                                                                                   | approved 2026-09-22                                                                                                                                                                                                                                           |
| [A-25](decisions/A-25-version-in-the-channel.md)          | 2026-09-22 | The contract version belongs to the channel: it adds `version` to every posted message and refuses a foreign version before the guard runs; the contract describes message bodies only and neither application knows the version exists. Wire unchanged.                                                                                                                                                                                                                                              | approved 2026-09-22                                                                                                                                                                                                                                           |
| [A-26](decisions/A-26-zod-contract.md)                    | 2026-09-22 | The contract is declared once as zod schemas: one `z.object` per message, discriminated unions for the two directions, types by `z.infer`, guards by `safeParse`; the `.props.ts` files and the primitive guards are gone. `zod` is the first library in the project. Wire unchanged.                                                                                                                                                                                                                 | approved 2026-09-22                                                                                                                                                                                                                                           |
| [A-27](decisions/A-27-folder-layout.md)                   | 2026-09-22 | A folder names a side or a role (channel `host/ viewer/ shared/`, extension `commands/ events/ ohif/`, host-app `channel/ form/ components/ pages/`); no file under twenty lines; `index.ts` only as a package entry; `.props.ts` only beside a React component.                                                                                                                                                                                                                                      | approved 2026-09-22                                                                                                                                                                                                                                           |
| [A-28](decisions/A-28-boundaries-as-schemas.md)           | 2026-09-22 | A foreign object is checked by one schema where it enters (wire, OHIF measurement, stored row); a shape is declared once and derived from (`StoredRow`, `MetricKey` enum, tool → metric map); an API without a caller is removed (`on`, viewer state, disposer set, `hostOrigin` option, optional OHIF services). One wire change: an unknown metric key is refused.                                                                                                                                  | approved 2026-09-22                                                                                                                                                                                                                                           |

## Appendix A — original assignment text (verbatim, Ukrainian)

```text
Тестове завдання: мікрофронтенд «Viewer + Scoring Form»
Роль: Frontend Developer (React / TypeScript)
Термін: 5 робочих днів
Формат здачі: відкритий репозиторій + відео-демо + захист роботи на дзвінку (30–45 хв)

1. Мета завдання
Це завдання відтворює у спрощеному вигляді те, чим ви будете займатися щодня: два окремих застосунки, які живуть на різних портах і спілкуються між собою.
З одного боку — медичний переглядач зображень (OHIF Viewer), з іншого — форма, у яку лікар вносить результати вимірювань. Форма не малює анотації сама: вона просить переглядач увімкнути інструмент, а потім отримує назад результат.
Ми перевіряємо не вміння написати форму на React. Ми перевіряємо, чи розумієте ви:
- як два незалежні застосунки домовляються про контракт обміну повідомленнями;
- як не зламатися на асинхронності (хто завантажився першим, що робити з повідомленнями, які прийшли «зарано»);
- як зв'язати сутність у формі з анотацією у переглядачі та тримати їх синхронними;
- як не влаштувати нескінченний цикл, коли зміна з одного боку викликає зміну з іншого, а та — знову першу.
Про AI. Використовувати AI-асистентів дозволено і навіть очікувано — ми самі ними користуємось. Але код, який ви здаєте, ви захищаєте самі: на дзвінку ми попросимо пояснити рішення й внести кілька живих змін (див. розділ 9). Код, який ви не можете пояснити, зараховано не буде.

2. Як це виглядає в реальному продукті (контекст)
У нашому продукті лікар відкриває дослідження пацієнта. Праворуч від зображення — скоринг-форма клінічного дослідження. Щоб додати вимірювання пухлини, лікар натискає кнопку в формі, а не в тулбарі переглядача: форма знає, який саме інструмент потрібен для цього поля (еліпс, лінійка, сегментація) і які обмеження діють.
Далі: переглядач вмикає потрібний інструмент → лікар малює анотацію → переглядач віддає у форму площу/довжину → форма зберігає значення й перераховує похідні показники (сума площ, відповідь на терапію тощо).
Ваше завдання — зробити найпростіший робочий скелет цієї схеми.

3. Архітектура, яку треба побудувати
Два застосунки, два порти, обмін через window.postMessage.
- viewer — форк офіційного https://github.com/OHIF/Viewers, запущений локально. Ви додаєте до нього власне OHIF-розширення (extension), яке виступає мостом: приймає команди ззовні й публікує події назовні.
- host-app — новий React-застосунок з нуля на будь-якому бойлерплейті (Vite рекомендовано). Містить <iframe> з переглядачем і форму.
Підказка щодо OHIF. Не намагайтесь дістати внутрішні сервіси через window ззовні — це не спрацює через iframe. Правильний шлях: власне розширення отримує servicesManager і commandsManager у хуку preRegistration. Саме там живе ваш міст: підписки на measurementService і виклики commandsManager.runCommand(...).

4. Обов'язкова частина
4.1. Запуск переглядача
- Форкнути https://github.com/OHIF/Viewers, запустити локально.
- Джерело даних — публічний DICOMweb за замовчуванням з коробки OHIF (свій PACS піднімати не потрібно).
- Переглядач має відкриватись за прямим посиланням на конкретне дослідження (/viewer?StudyInstanceUIDs=...), бо саме таке посилання піде в iframe.
4.2. Host-app і сторінка
- React + TypeScript.
- Одна сторінка: ліворуч iframe з переглядачем (гумовий, на всю висоту), праворуч — панель форми.
- Порти застосунків різні — це навмисно, щоб ви зіткнулися з реальними обмеженнями cross-origin.
4.3. Сценарій «додати вимірювання» (ядро завдання)
1. У формі є кнопка «Додати вимірювання».
2. Натискання створює у формі новий порожній рядок зі статусом Очікує і кнопкою «Активувати».
3. Натискання «Активувати» надсилає в iframe команду увімкнути інструмент Ellipse (EllipticalROI). Рядок переходить у статус Малювання….
4. Користувач малює еліпс у переглядачі.
5. Переглядач надсилає назад площу анотації разом з ідентифікатором, за яким host розуміє, до якого саме рядка це значення належить.
6. Рядок отримує значення (наприклад 124.5 mm²), статус Готово, інструмент у переглядачі вимикається сам (повертається Pan/дефолт).
7. Кроки 1–6 повторювані: рядків може бути скільки завгодно.
8. Унизу форми — сума площ усіх рядків, яка перераховується автоматично.
4.4. Мінімальний контракт повідомлень
Назви подій зафіксовані нижче, структуру payload проєктуєте ви самі — і описуєте в ARCHITECTURE.md.
| Напрямок | Тип події | Призначення |
| viewer → host | VIEWER_READY | Переглядач завантажився й готовий приймати команди |
| host → viewer | ACTIVATE_TOOL | Увімкнути інструмент для конкретного рядка форми |
| host → viewer | DEACTIVATE_TOOL | Скасувати очікування малювання |
| viewer → host | MEASUREMENT_ADDED | Анотацію створено; значення + одиниці + прив'язка |
| viewer → host | MEASUREMENT_UPDATED | Анотацію змінили (див. зіркове завдання 5.1) |
Домовтеся про версію контракту (version: 1) і закладіть її в повідомлення — поясните на захисті, навіщо.

5. Вимоги до якості (оцінюються окремо)
Це те, що відрізняє «працює на демо» від «працює в продукті». Кожен пункт — окремий рядок в оцінюванні.
- Handshake. Host не має права надсилати команди до того, як переглядач повідомив VIEWER_READY. Якщо користувач натиснув «Активувати», поки iframe ще вантажиться, команда не має загубитись — подумайте, що з нею зробити.
- Перевірка origin. Обробники message з обох боків мають перевіряти event.origin і не реагувати на чуже. Захардкоджений origin у конфізі — нормально; його відсутність — ні.
- Кореляція. Кожен рядок форми має свій ідентифікатор; кожна анотація — свій. Ви маєте свідомо вирішити, хто кому видає ID і як тримається відповідність між ними. Це головне архітектурне рішення завдання.
- Відсутність echo-циклу. Якщо ви реалізуєте зіркове завдання 5.1 — переконайтесь, що оновлення host → viewer → host не породжує нескінченний пінг-понг. Ми це перевіримо.
- Прибирання за собою. removeEventListener, відписки від measurementService, скасування «озброєного» стану при unmount.
- Одиниці вимірювання. Площа може приходити в mm² або в px² — залежно від того, чи є в DICOM пікселний spacing. Не втрачайте одиниці й не додавайте mm² до px² у сумі. Опишіть, що робите в цьому випадку.
- TypeScript. Типи повідомлень описані в одному місці й спільні для обох застосунків (окремий пакет, спільна тека або хоч би скопійований файл із поясненням, чому так).

6. Зіркові завдання (*) — за бажанням
Робіть у порядку інтересу, жодне не є обов'язковим. Одне-два виконаних зіркових завдання суттєво впливають на оцінку — але тільки якщо обов'язкова частина зроблена якісно.
- 5.1. Живе оновлення. Користувач тягне вершину еліпса — значення в формі оновлюється в реальному часі, сума перераховується.
- 5.2. Видалення. Кнопка «Видалити» в рядку форми прибирає анотацію в переглядачі. І навпаки: видалення анотації в переглядачі очищає рядок.
- 5.3. Фокус. Клік по рядку форми підсвічує/скролить до відповідної анотації в переглядачі.
- 5.4. Другий інструмент. Додайте тип рядка «Довжина» (Length) — сума довжин рахується окремо від суми площ.
- 5.5. Версія на вьюпорті. Вивести версію OHIF (з package.json, підставлену на етапі збірки через конфіг бандлера) у кутку кожного вьюпорта — якщо обрано сітку 2×2, версія має бути на всіх чотирьох.
- 5.6. Відновлення стану. Після перезавантаження сторінки форма й анотації відновлюються.

7. Формат здачі
7.1. Репозиторії та pull request'и
- Код у відкритому репозиторії (GitHub / GitLab). Форк OHIF + host-app можуть бути двома репозиторіями або монорепо — на ваш вибір, поясніть чому.
- Обов'язково: робота розбита на pull request'и по фічах. Мінімум п'ять, орієнтовно: 1. chore: bootstrap host-app — каркас, iframe, layout 2. feat: viewer bridge extension — OHIF-розширення + handshake 3. feat: activate ellipse from form — напрямок host → viewer 4. feat: receive measurement into form — напрямок viewer → host 5. feat: total area calculation — сума й форматування
- Кожен PR має осмислений опис: що змінено, чому саме так, що перевірено. PR з описом «changes» не зараховується.
- PR можуть бути змержені вами ж — код-рев'ю від нас на цьому етапі немає. Нам важлива історія мислення, а не одна купа коду.
7.2. Документація в репозиторії
- README.md — як запустити обидва застосунки з нуля (git clone → робочий екран). Ми буквально виконаємо ці кроки на чистій машині.
- ARCHITECTURE.md — схема обміну, повна таблиця повідомлень з payload, і окремий розділ «Прийняті рішення»: хто видає ID, як влаштований handshake, що робиться з командами, які прийшли зарано, як уникається echo-цикл. Достатньо 1–2 сторінок, але по суті.
- AI-USAGE.md — чесно: де використовували AI, що з його виводу залишили без змін, а що переписали й чому. Це не мінус в оцінюванні — навпаки, вміння працювати з AI критично оцінюється. Мінус — приховати це.
7.3. Відео-демо (обов'язково)
Запис екрана 2–4 хвилини, голос за кадром бажаний, де показано:
- запуск обох застосунків;
- додавання щонайменше трьох вимірювань поспіль;
- як оновлюється сума;
- поведінку при скасуванні активації (натиснули «Активувати» й передумали);
- будь-які реалізовані зіркові завдання.

8. Чого робити не треба
Щоб ви не витрачали час не на те:
- Не потрібна авторизація, бекенд, база даних, збереження на сервер.
- Не потрібен власний PACS / DICOMweb-сервер.
- Не потрібен дизайн — сірої форми з нативними інпутами повністю достатньо.
- Не потрібні тести на весь проєкт. Якщо хочете показати вміння — достатньо кількох юніт-тестів на логіку суми та на серіалізацію повідомлень.
- Не потрібно перероблювати UI самого OHIF (панелі, тулбар) — окрім того, що вимагає ваш міст.

9. Захист роботи
Після здачі — дзвінок на 30–45 хвилин. Це основна частина оцінювання.
Питання, до яких варто бути готовим:
- Що станеться, якщо iframe завантажиться повільніше, ніж користувач натисне кнопку? Покажіть у коді, де це оброблено.
- Чому ви обрали postMessage, а не інший спосіб? Що б змінилось, якби обидва застосунки були на одному домені?
- Хто видає ідентифікатор вимірювання й чому саме він? Що зламається, якщо переклацнути це рішення на протилежне?
- Де саме в OHIF ви підписались на створення анотації і чому саме там?
- Що буде, якщо відкрити дві вкладки host-app одночасно?
- Покажіть місце, де міг би виникнути нескінченний цикл повідомлень.
Живі зміни (виконуються під час дзвінка, ~10 хв кожна):
- Замінити інструмент з еліпса на прямокутник (RectangleROI).
- Додати до рядка форми ще одне поле — наприклад, периметр або середню інтенсивність — і провести його через увесь ланцюжок.
- Ми вимкнемо один елемент вашого протоколу (наприклад, VIEWER_READY) — ви маєте продіагностувати поломку вголос.

10. Критерії оцінювання
| Блок | Що дивимось | Вага |
| Робочий сценарій | Обов'язкова частина відтворюється з README без підказок | 25% |
| Архітектура мосту | Контракт, кореляція ID, handshake, розділення відповідальності | 25% |
| Захист роботи | Пояснення рішень і живі зміни на дзвінку | 25% |
| Якість коду | Типізація, прибирання ефектів, структура, читабельність | 15% |
| Комунікація | PR'и, ARCHITECTURE.md, відео-демо | 10% |
Зіркові завдання додають до +15% зверху, але не компенсують провалений блок «Захист роботи».

11. Корисні орієнтири
- OHIF Viewer: https://github.com/OHIF/Viewers
- Документація OHIF (extensions, services): https://docs.ohif.org
- window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- Ключові речі в OHIF, які вам знадобляться: хук preRegistration у розширенні, commandsManager.runCommand('setToolActive', ...), measurementService.subscribe(measurementService.EVENTS.MEASUREMENT_ADDED, ...).
Якщо щось у завданні здається неоднозначним — прийміть рішення самі й задокументуйте його в ARCHITECTURE.md. Уміння закрити невизначеність самостійно теж оцінюється.
Питання по завданню: @acestudiooleg Telegram
```
