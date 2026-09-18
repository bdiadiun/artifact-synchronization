# context

React context providers shared by unrelated parts of the component tree.

Currently unused: all application state lives in the form reducer (`form/rows.ts`),
is owned by `hooks/useScoringForm` and is passed down as props, which is at most two
levels deep. A provider is added only when two unrelated subtrees need the same state.
