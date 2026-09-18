---
name: slice
description: Run one slice of work end to end in this repository — plan against the canon and the feature graph, get the plan approved, delegate the implementation, verify it, and prepare the pull request. Use when starting any change that is not a one-line fix.
user-invocable: true
---

# One slice, two gates

Work in this repository moves in slices: one vertical, self-contained change, one branch, one pull
request. Every slice passes two approval gates with the author. The full rules are in `CLAUDE.md`;
this skill is the short operating procedure.

## Before anything

1. Read `CLAUDE.md`, then `docs/STATE.md`, then the rows of `docs/FEATURE-GRAPH.md` for the slice at
   hand. Do not re-derive decisions already recorded in `docs/decisions/`.
2. Run `npm run check:graph`. It must pass 15/15 before you change anything.

## Gate 1 — the plan

Present, in a few lines each:

- the graph nodes and canon ids the slice closes (every node lists at least one `C-`, `Q-`, `D-` or
  `S-` id; code that traces to nothing is not written);
- the files that will be created or changed;
- the decisions with their alternatives, one recommendation each;
- how it will be verified;
- which agents will run, on which model, with which brief.

Wait for an explicit approval. If the plan changes materially while implementing, stop and return
to this gate.

## Implementation

- Delegate with self-contained briefs: role, branch, files in scope, the decisions already made,
  the verification commands, and the report format. Developers and testers run on smaller models;
  the architect reviews.
- Never let two agents write the same files at the same time, and never run the git operator while
  another agent is still writing.
- One instance per role. Continue a running agent with a message rather than calling a second one,
  and when an agent runs out of context follow `.claude/skills/handover/SKILL.md` so a successor of
  the same role picks the work up.
- Update `docs/feature-graph.json` (never the generated Markdown) and `docs/STATE.md` in the same
  slice as the work they describe.

## Gate 2 — the result

Run the verification yourself before showing it: `/verify`, plus a browser scenario (`/e2e`) when
the slice touches the bridge. Then present the diff summary, the verification output, the review
notes on what the agents produced, and a draft pull request description in the four-section
template from `CLAUDE.md`. Wait for approval before any commit, push, pull request or merge.

## After the merge

Close the node with `/close-node <F-nn>`, because a node is only `done` once its pull request is
merged.
