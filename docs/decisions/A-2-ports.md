# A-2 — Fixed ports 5173 (host-app) and 3000 (viewer)

Status: approved 2026-09-16; amended 2026-09-21 by
[A-20](A-20-three-layers.md): the viewer no longer carries the host origin in its own source. It is
a published package now, so the origin arrives from the deployment's configuration and the bridge
refuses to start without one rather than accepting any page. Canon: C-4.2.3, Q-2.

## Context

The two apps must run on different ports (C-4.2.3) and each side must check `event.origin`
against a configured value (Q-2).

## Decision

host-app runs on `http://localhost:5173`, the viewer on `http://localhost:3000`. Both values are
constants in each app's config and are the only accepted origins.

## Rejected alternatives

- Reading the origin from the incoming message: defeats the purpose of the check.
- Environment-driven ports: extra setup on the reviewer's machine for no benefit in this assignment.

## Consequences

- The README "clean machine" run uses exactly these ports; a port clash is documented as a known issue.
