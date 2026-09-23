# AI usage

This project was built with an AI coding assistant driving the process. What follows is what it
did, what was kept, what was rewritten, and how the author stays able to defend every line.

## How the work was organised

- The assignment text was turned into a canon of atomic requirements with immutable IDs
  (`docs/CANON.md`) and a feature graph (`docs/FEATURE-GRAPH.md`) before any code. Every later
  change references those IDs; a script (`npm run check:graph`) keeps the graph consistent.
- Work went slice by slice, one PR each, with two approval gates per slice (plan, then result).
  Decisions on ambiguities were proposed by the assistant and approved by the author; each one is
  a record under `docs/decisions/`.
- An architect session planned, wrote the docs and decision records, reviewed every diff and ran
  the end-to-end checks. Implementation and tests were written by separate, smaller assistant
  sessions working from written briefs (canon IDs, files in scope, constraints, verification
  commands). Routine git (commit, rebase, push, PR, merge after approval) was also delegated.
- From slice 12 on, the roles are fixed in `.claude/agents/` (architect, developer, tester,
  researcher, git-operator) and every brief points to `docs/CONVENTIONS.md`, so the style no longer
  depends on which session wrote a file. Development and test agents run on smaller models than
  the architect; the architect reviews every diff and runs the end-to-end checks itself.
- Every slice was verified in a real browser with Playwright against both running apps, not only
  with unit tests; screenshots were reviewed before each merge.

## Where AI output was kept as is

- The OHIF research note (`docs/notes/ohif-api.md`): the assistant cloned the release tag,
  found the exact files and lines (measurement shape, event timing, `setToolActive`, validation
  that rejects custom fields). The findings were verified at runtime (drawing an ellipse headlessly)
  before they became decisions.
- Most of the code as delivered by the implementation sessions: the contract guards, the bridge
  client with its queue, the extension's command handling, the reducers and the totals function,
  and the unit tests. They were reviewed against the briefs and the canon, not rewritten for style.
- The Playwright end-to-end scripts used for verification (kept outside the repository).

## What was corrected or rewritten, and why

- The first version of the feature graph missed two mandatory IDs (C-3.1, D-4) in node rows; the
  assistant's own invariant script caught it and the rows were fixed.
- The canon initially said the tool returns to "Pan/default". The research showed the default
  primary tool in the longitudinal mode is WindowLevel, so the decision became "restore the tool
  that was active before arming" (A-8) rather than hardcoding a name. The minimal-bridge slice
  (A-23) later replaced the snapshot with the fixed default, `WindowLevel`, once it was clear the
  snapshot was the only reason the extension had to remember anything about the tool.
- The contract was first wired as a Vite alias to a shared folder; it was reworked into an npm
  published package (`@bdiadiun/scoring-contract`, A-12 and A-15) so the dependency is explicit.
- `VIEWER_READY` was planned to be sent from `preRegistration`; the implementation session found
  that `setToolActive` is a silent no-op before a viewport exists and moved the announcement to the
  first `VIEWPORT_ADDED`. The decision record was updated to match.
- A Ukrainian plural form generated for the count footer was wrong ("виміру") and was corrected.
- The claim that a mono-repo lets one PR change both sides of the contract was withdrawn once the
  viewer became a submodule; the decision record (A-1) now states what the mono-repo actually buys.
- Live update: the first version logged one warning per animation frame while a handle was dragged
  (about 40 per drag), because cornerstone has no stats on intermediate frames; the mapping was
  made quiet on that path. A one-shot correction after `MEASUREMENT_ADDED` was added when the
  architect's review showed that stats can settle one frame after completion; A-23 removed it
  again, because the live-update stream delivers that same settled value.
- Deletion: the brief assumed a `remove(uid, source, details)` signature; the implementation
  session checked the pinned OHIF source, found a one-argument method, and used the real one. The
  deletion made in the viewer was first simulated through the service; it was redone through the
  actual OHIF measurements panel so the check matches what a doctor does.
- Focus: an end-to-end check clicked the wrong element (a row that was not clickable) and reported
  a false failure; the architect traced it through the viewer console and fixed the test, not the
  code.
- Docs page: the generator initially pinned a Mermaid version that does not exist on cdnjs, so
  diagrams silently did not render; the architect found the 404 and the missing first render.
  Later, running Prettier over the repository changed the placeholder the generator replaces, and
  the page shipped with no documents; the generator now tolerates the change and fails loudly.
- Conventions: the lint rule meant to forbid numeric enums never fired because its AST selector
  did not match typescript-eslint v8; the architect caught it with a probe file. Introducing enums
  broke the build because the Vite template enables `erasableSyntaxOnly`; the developer session
  stopped and reported instead of changing the TypeScript config on its own.
- A pull request description in the OHIF fork was written in Ukrainian against the repository
  rules and was rewritten in English.
- CI: running the checks from a clean `npm ci` showed that tests and type-aware lint had only been
  passing on a warm local install (npm had hoisted test libraries away from the types they need).
  The dependency layout was fixed and the rule added to the conventions.

## What the tests are for

The test suite in this repository is not a person's hand-written safety net for their own code. No
test here was typed by the author. The code is generated, and the tests exist to answer one
question about it: does the generated code do what it was briefed to do.

That difference shapes how they are written and where they sit.

- The author's contribution is the checking system, not the assertions: roles that cannot review
  their own work, a brief that states what must be proved, and a rule that a claim counts only when
  an artefact backs it. The agent that writes application code is forbidden to touch a test, and
  the agent that writes tests is forbidden to touch application code, so a failing test is never
  quietly adjusted by whoever caused it to fail.
- A test is expected to fail on purpose at least once. Coverage of a rule counts when the rule was
  broken deliberately, the failure was seen, and the break was reverted; several rules in this
  repository are recorded exactly that way, and one place where that proof could not be produced is
  named as a gap rather than glossed over.
- The suite is deliberately narrow, as the assignment asks: the sum logic, the message guards, the
  channel's handshake and cleanup, and the rules that protect a URL or an origin. It is not an
  attempt at broad coverage, which would measure the generator rather than the behaviour.

The author reads the diffs, runs the verification, and decides the gates. The tests are the part of
that process which does not depend on anybody reading carefully on a given day.

## What the author verifies by hand

- Every PR description's "How it was verified" section corresponds to commands and browser checks
  that were actually run; screenshots of the end-to-end runs were reviewed.
- The defence notes (`docs/DEFENCE.md`) map each expected question and live change to the exact
  place in the code.
- The author decides every gate: each slice plan and each result was approved in chat before any
  commit, and design choices with trade-offs (repository layout, ID ownership, enum policy, which
  bonus tasks to build) were presented as options with a recommendation and chosen by the author.

## Where AI was not used

- The demo video is recorded and narrated by the author.
- The defence call: `docs/DEFENCE.md` is a map to the code, not a script to read.
