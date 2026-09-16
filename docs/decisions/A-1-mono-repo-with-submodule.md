# A-1 — Mono-repo with the OHIF fork as a git submodule

Status: approved 2026-09-16. Canon: D-1, C-4.1.1.

## Context

The assignment allows either two repositories or a mono-repo and asks for the choice to be explained.
The message contract (C-4.4) is shared by both sides; a change to it touches the host-app and the
viewer extension at the same time.

## Decision

This repository is the mono-repo: `host-app/` lives here, and the OHIF fork
(https://github.com/bdiadiun/Viewers) is mounted as a git submodule at `viewer/`, pinned to a commit
on our fork branch. The bridge extension lives inside the fork under `extensions/`.

## Rejected alternatives

- Two independent repositories: every contract change needs two PRs and a manual version dance;
  the "history of thinking" (D-4) is split.
- Vendoring the OHIF source into this repo: hundreds of megabytes, loses the upstream link and the
  ability to show the fork diff.

## Consequences

- `README.md` must document `git clone --recurse-submodules` (D-5).
- A change in the extension is two commits: one in the fork (own PR there), one bumping the
  submodule pointer here. A contract change is therefore never a single PR; the main-repo PR links
  the fork PR and `npm run check:contract` guards the copy (A-12).
- What the mono-repo buys, stated honestly (re-confirmed 2026-09-16): one clone with the viewer
  pinned to the exact tested commit; the contract as a real package for host-app; canon, graph,
  ARCHITECTURE and decisions in one place. It does not buy atomic cross-repo changes.
