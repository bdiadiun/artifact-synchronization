// An exchange rejects when the viewer never answered or the bridge went away mid-request (A-21).
// Neither is recoverable here; both are worth seeing in the console.
export const warnUnanswered = (error: unknown): void => {
  console.warn('[form] a request to the viewer went unanswered', error);
};
