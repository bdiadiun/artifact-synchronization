# A-16 — the bridge is an adapter with a handler registry; the viewer is deployed, not published

Status: approved 2026-09-20. Canon: C-3.2, Q-7, X-5. Related: [A-1](A-1-mono-repo-with-submodule.md),
[A-15](A-15-publish-contract-package.md). Evidence: [ohif-packaging.md](../notes/ohif-packaging.md).

## Context

Two questions came up together. Our own code lives inside the fork's tree, which makes it hard to
see what we wrote; and it would be better if the fork stopped changing at all, so that new
behaviour did not mean a pull request against somebody else's repository every time.

Moving the whole extension into a package of our own was tried and does not work: no OHIF package
on npm ships type declarations, and the global namespace the extension uses only resolves inside
the OHIF monorepo. Publishing declarations emitted from the fork does work, but one of the eight
type names we need silently degrades to `any` and `skipLibCheck` hides that, so the strictness
would be theatre exactly where we do not control the code.

## Decision

- **The extension is an adapter.** A registry maps a command type to its handler. Adding a
  capability means registering a handler, not editing a dispatcher.
- **Completeness is kept at the type level.** The registration map is written against the contract's
  own union of command types, so a command added to the contract without a handler fails the type
  check. This replaces the exhaustiveness the previous `switch` provided through its `never` branch.
- **The registry holds no OHIF import**, so it is pure logic and can be tested without the viewer.
- **The fork's diff stays frozen** at the registration entry in `platform/app/pluginConfig.json`,
  the dependency line in `platform/app/package.json` and the extension's workflow.
- **The viewer is delivered by deployment, not by an npm package.** The host reads the viewer's
  address from configuration, so a deployed viewer replaces the local one without a code change.

## Why this way

The fork can stay frozen because OHIF computes almost everything at call time. Commands registered
through `commandsManager` and values supplied through `setCustomizations` are read from live
managers, so the adapter can grow without OHIF learning about it. What must be declared once, at
registration, is small: the extension id, the lifecycle hooks and the presence of the module
getters. One case does reopen the fork, and it is worth knowing before promising otherwise: a
panel, a viewport or a toolbar button is named statically by the mode, so adding one costs an edit
there.

Packaging the built viewer as a dependency was considered and rejected on evidence. It is an
application bundle, not a library: its manifest points `main` at a file the build never produces,
its asset paths are baked absolute at build time, and the output is 199 MB. The only consumable
form is that static output served at the root of a port and configured at deploy time, which is
precisely deployment. Publishing it would also mean shipping a third party's application under our
own name for no gain.

A second path exists for adding an extension without rebuilding: `window.config.extensions` is read
after the bundle loads, and an unknown entry is fetched by dynamic import. It is recorded here
because it is real, and rejected because such a module carries its own copies of React and
`@ohif/core` and must arrive before initialisation finishes.

## Consequences

- New viewer-side behaviour is a handler plus, when the host must ask for it, a message in the
  contract. Neither touches the fork.
- The registry is the one place to look for what the viewer can be asked to do.
- Moving the OHIF-free half of the extension into a package of its own stays open as a later step;
  nothing here blocks it.
