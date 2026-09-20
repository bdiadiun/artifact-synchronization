# A-18 — the viewer is checked out on demand, not carried as a submodule

Status: approved 2026-09-20. Canon: C-3.2, D-1, D-5. Supersedes the submodule part of
[A-1](A-1-mono-repo-with-submodule.md). Related: [A-16](A-16-adapter-and-viewer-delivery.md),
[A-17](A-17-orchestrator-package.md).

## Context

A-1 put the OHIF fork in this repository as a git submodule so that one pull request could change
both sides of the contract and so that a reviewer could clone once and run everything. Both
reasons have since expired.

The contract is a published package (A-15) and so is the channel (A-17), so a change to either is
released rather than co-committed. The extension is an adapter whose capabilities are registered
rather than hard-wired (A-16), so the fork's own diff is frozen at its registration entry, a
dependency line and its workflow. What remained was a 199 MB checkout of somebody else's
application sitting inside our tree, where it made it hard to tell whose code was whose and filled
every search with foreign results.

## Decision

- `viewer/` is no longer a submodule. It is a local checkout, ignored by git.
- `npm run viewer:setup` clones the fork at an exact commit recorded in a small committed file, and
  installs it with its own package manager. `npm run viewer:dev` starts it.
- The pinned commit is part of this repository, so a reviewer runs the viewer we tested against
  rather than whatever the fork's branch points at later.
- The fork stays where it is, `https://github.com/bdiadiun/Viewers` on branch `scoring`. It is the
  answer to the canon's requirement for a fork of OHIF extended with our own extension, and its
  pull requests are part of the deliverable.
- Linting the fork's sources from this repository now depends on that checkout being present, and
  says so when it is not. The fork's own workflow builds the extension on every change there, so
  nothing is left unchecked.

## Why this way

Keeping the checkout pinned matters more than keeping it vendored. A submodule and a pinned clone
give the same reproducibility; only one of them also puts a hundred thousand foreign files in the
way of everyday work.

The cost is one extra command before the first run, and it is written at the top of the README.
That is the honest trade: the reviewer types one line, and in exchange every file in this
repository is ours.

Two alternatives were rejected. Hiding the folder in editor settings solves the noise for whoever
shares those settings and nobody else, and leaves the checkout in the repository. Vendoring the
built viewer instead was measured and rejected in A-16: it is an application bundle, not something
a project depends on.

## Consequences

- A fresh clone runs the form immediately and needs one command before it can run the viewer.
- The pinned commit has to be raised deliberately when the fork moves, which is a feature: the
  viewer version becomes an explicit decision rather than a silent one.
- Graph checks treat paths under `viewer/` as satisfied when the checkout is absent, and say so in
  their output instead of passing quietly.
