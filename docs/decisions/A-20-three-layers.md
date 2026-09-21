# A-20 — three layers: an unchanging fork, an adapter, and extensions

Status: approved 2026-09-21. Canon: C-3.2, Q-7, X-5. Related:
[A-16](A-16-adapter-and-viewer-delivery.md), [A-17](A-17-orchestrator-package.md),
[A-18](A-18-viewer-checked-out-not-vendored.md). Evidence:
[ohif-packaging.md](../notes/ohif-packaging.md),
[ohif-extension-composition.md](../notes/ohif-extension-composition.md).

## Context

Our viewer-side code lived inside the fork, so every change to it was a pull request against a
checkout of somebody else's application. Making the extension an adapter with a handler registry
(A-16) stopped the fork's diff from growing, but the code was still in there, and adding a second
capability would still have meant opening the fork.

Reading the extension manager settled what is actually possible at `v3.12.17`. An extension's
`preRegistration` receives the extension manager itself, `registerExtension` is public, the outer
loop iterates the array it was given rather than the manager's own list, and a duplicate id is
skipped with a warning. So an extension can register other extensions, and OHIF already does this
late itself when a mode is entered.

## Decision

Three layers, each changing for its own reason.

- **The fork** carries one entry in `platform/app/pluginConfig.json`, the matching dependency, and
  nothing else of ours. It changes when OHIF changes, not when we do.
- **The adapter** is a published package, registered once by that entry. In `preRegistration` it
  registers our extensions through the extension manager, so the children are in place before the
  application finishes starting, in a deterministic order.
- **The extensions** are published packages the adapter depends on. The first of them is
  `@bdiadiun/ohif-extension-scoring-bridge`. Adding or changing one is a change to the adapter and
  its dependencies. No fork involved.

Two rules come with it:

- **Command names are prefixed per package.** OHIF does not namespace commands: the commands
  manager writes straight into a shared context, so a name that collides with another extension's
  silently replaces its behaviour. Module names are namespaced by extension id; command names are
  not.
- **We describe the OHIF surface we call, and only that.** Fifteen members across five services and the
  commands manager, counted from the code rather than from memory: the measurement, tool group,
  cornerstone viewport, viewport grid and display set services. We do not vendor or generate OHIF's own declarations, which were measured
  and rejected in A-16.

## Why this way

It separates what changes together. OHIF's version is somebody else's schedule; our capabilities
are ours; the wiring between them is a third thing that changes rarely. Before this, all three were
the same pull request.

The cost is stated rather than hidden. The fork still pins a version, so a release of the adapter
is a one-line bump there; that is a number, not code, and we prefer it to the alternative. The
alternative exists and was considered: `window.config.extensions` is read after the bundle loads
and an unknown entry is fetched by dynamic import, so the adapter could be supplied entirely by
deployment configuration. It was rejected because such a module carries its own copies of React and
`@ohif/core`, must arrive before initialisation finishes, and moves every failure from build time
to somebody's browser.

Because our interfaces replace the compiler's knowledge of OHIF, a drift between them and the real
API cannot be caught by a type check. It is caught by building the viewer and running the browser
scenario, and both belong to the verification of any slice that touches this code.

## Consequences

- Commands, customizations, hanging protocols and toolbar evaluators all work when registered this
  late; that covers everything we do today.
- A panel, a viewport or a toolbar button is named statically by a mode. Modes are packages too and
  are listed beside extensions, so the escape is to publish our own mode; the fork lists it once.
  A data source needs an explicit call and is out of scope here.
- Our viewer-side code becomes subject to this repository's strict type check and its tests for the
  first time.
