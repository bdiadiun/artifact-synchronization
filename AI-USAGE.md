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

## Where AI output was kept as is

- The OHIF research note (`docs/notes/ohif-bridge-api.md`): the assistant cloned the release tag,
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
  that was active before arming" (A-8) rather than hardcoding a name.
- The contract was first wired as a Vite alias to a shared folder; it was reworked into an npm
  workspace package (`@scoring/contract`, A-12) so the dependency is explicit.
- `VIEWER_READY` was planned to be sent from `preRegistration`; the implementation session found
  that `setToolActive` is a silent no-op before a viewport exists and moved the announcement to the
  first `VIEWPORT_ADDED`. The decision record was updated to match.
- A Ukrainian plural form generated for the count footer was wrong ("виміру") and was corrected.
- The claim that a mono-repo lets one PR change both sides of the contract was withdrawn once the
  viewer became a submodule; the decision record (A-1) now states what the mono-repo actually buys.

## What the author verifies by hand

- Every PR description's "How it was verified" section corresponds to commands and browser checks
  that were actually run; screenshots of the end-to-end runs were reviewed.
- The defence notes (`docs/DEFENCE.md`) map each expected question and live change to the exact
  place in the code.
