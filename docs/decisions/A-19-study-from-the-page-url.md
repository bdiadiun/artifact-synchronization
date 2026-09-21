# A-19 — the form reads its study from its own URL

Status: approved 2026-09-21. Canon: C-4.1.3, S-5.6. Related:
[A-14](A-14-state-restore.md), [A-16](A-16-adapter-and-viewer-delivery.md).

**This is an addition of our own, not a requirement.** The assignment asks for the viewer to open a
specific study by a direct link, which a constant already satisfied. Nothing here is traced to a
`C-` or `S-` requirement, and the distinction is kept deliberately so the mandatory part stays
legible.

## Context

The study identifier was a constant in the form's configuration. It was already threaded through
four places: the viewer's URL, the key rows are stored under, the write of that store, and the
restore request. So the code was written as if the study could vary while it never could, and the
per-study storage key protected against a collision that could not happen.

## Decision

- The form reads a `study` parameter from its own page URL and uses it when it is valid; the
  previous constant stays as the fallback.
- A value is accepted only if it looks like a DICOM study instance identifier: digits and dots, no
  empty component, no leading or trailing dot, at most sixty-four characters. Anything else is
  refused, the fallback is used, and the refusal is logged once for whoever is looking.
- The identifier is put through `encodeURIComponent` when the viewer's URL is built.
- One value is resolved per page load and used by all four consumers.

## Why this way

The value ends up inside the `src` of an iframe, which makes it the one piece of attacker-reachable
input the form puts into a URL. Validation and encoding are two different defences and both are
kept: validation refuses what is not an identifier, and encoding makes sure that even an accepted
value cannot add a second query parameter or change the path. This is the same reasoning as the
origin check on incoming messages, applied to the one place where the form generates a URL from
outside input.

The fallback means a plain visit to the form still works exactly as before, so nothing about the
demonstration changes unless somebody asks for another study.

## Consequences

- Two tabs on different studies now keep separate rows, which is what the per-study storage key
  always claimed to do (A-14).
- Pointing a deployment at another study is a link, not a build.
- The mandatory behaviour is unchanged: with no parameter, the form opens the study it always did.
