// How long an exchange waits for its answer: long enough for a viewer busy hydrating a study,
// short enough that an unanswered request is reported while the page is still in front of someone.
export const DEFAULT_EXCHANGE_TIMEOUT_MS = 5000;

export const DEFAULT_LOG_PREFIX = '[channel]';
