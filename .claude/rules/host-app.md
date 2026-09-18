---
paths:
  - host-app/**
---

- Arrow functions with explicit return types on exports; string enums for application state.
- A component `{Name}.tsx` holds only rendering; its props, local types and `styles` live in the
  sibling `{Name}.props.ts`. No inline `style={{ … }}`, no function created inside an `on…` prop, and no
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
