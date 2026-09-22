# A-27 — a folder names a side or a role, and no file is smaller than a screen

Status: approved 2026-09-22. Canon: D-2, A-13. Related: [A-24](A-24-plain-code.md),
[A-23](A-23-minimal-bridge.md).

## Context

Each package had one flat `src/` with a dozen files at the same level, several of them five lines
long; the file list did not say what belonged to what, and the author found it impossible to hold.

## Decision

- **A folder is a side or a role**: the channel has `host/`, `viewer/`, `shared/`; the viewer
  extension has `commands/` (host → OHIF), `events/` (OHIF → host), `ohif/` (the OHIF surface, the
  throttle, the overlay); the host application has `channel/` (React ↔ channel), `form/` (rows,
  actions, events, storage, totals, formatting, the form hook), `components/`, `pages/`. `hooks/`
  and `utils/` are gone: a hook lives beside what it connects, a helper beside its only caller.
- **No file under twenty lines**: a constant, a type or a one-function module joins its owner.
- **`index.ts` is a package's public entry only**; no barrel inside a folder.
- **`.props.ts` exists only beside a React component.**
- Tests keep living in a `__tests__/` folder beside the code they test and move with it.

## Why this way

The tree should answer "what is this" before a file is opened. Splitting by role is the same idea
as A-23 (protocol vs OHIF) applied to folders.
