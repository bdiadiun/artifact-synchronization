// How long an exchange waits for its answer: long enough for a viewer busy hydrating a study,
// short enough that an unanswered request is reported while the page is still in front of someone.
export const EXCHANGE_TIMEOUT_MS = 5000;

// One prefix for both ends: each end writes into its own console (the viewer's is the iframe's),
// so naming the end as well bought nothing and had to be threaded through every module.
export const LOG_PREFIX = '[channel]';
