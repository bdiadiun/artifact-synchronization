# redux

Redux store, slices and typed hooks, if the application ever needs a global store.

Currently unused: state is small and local, so it lives in the form reducer
(`form/rows.ts`) behind `hooks/useScoringForm` and is passed as props instead.
