---
paths:
  - host-app/**
---

- Arrow functions with explicit return types on exports; string enums for application state.
- A component `{Name}.tsx` holds only rendering; its props, local types and `styles` live in the
  sibling `{Name}.props.ts`. No inline `style={{ … }}` and no function created inside an `on…` prop.
- User-visible strings come from `src/i18n.ts` as `t.<key>` (Ukrainian, decision A-7).
- Tests live in a `__tests__/` folder next to the code they test.
- Never trust an incoming message: validate it with the contract guards, check `event.origin`, and
  never call `postMessage` with `'*'`.
- Size limits are lint errors: a function under 60 lines, a file under 200, complexity under 10.
