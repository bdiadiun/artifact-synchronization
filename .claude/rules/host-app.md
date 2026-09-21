---
paths:
  - host-app/**
---

- Arrow functions with explicit return types on exports; string enums for application state.
- Every `.ts` and `.tsx` file keeps its `interface` and `type` declarations and its `styles` object
  in a sibling `{Name}.props.ts`, components and plain modules alike (lint rule). Enums stay with
  their code; the published contract file is exempt. No inline `style={{ … }}`, no function created inside an `on…` prop, and no
  function created anywhere in the `return` statement: it is declared with a name above it. A list
  render's `.map` callback is the only exception.
- User-visible strings come from `src/i18n.ts` as `t.<key>` (Ukrainian, decision A-7).
- Tests live in a `__tests__/` folder next to the code they test.
- Folder layout follows `docs/PROJECT-STRUCTURE.md`. A folder the layout names but the repository
  does not have yet (`assets/`, `context/`, `redux/`) is created only when its first file arrives,
  under that exact name.
- Never trust an incoming message: validate it with the contract guards, check `event.origin`, and
  never call `postMessage` with `'*'`.
- Size limits are lint errors: a function under 60 lines, a file under 200, complexity under 10.
