import type { ViewerEvent } from '@bdiadiun/scoring-contract';

export const EXCHANGE_TIMEOUT_MS = 5000;

export interface PendingAnswers {
  awaitAnswer: (requestId: string, commandType: string, answerType: string) => Promise<ViewerEvent>;
  settle: (event: ViewerEvent) => boolean;
  rejectAll: (reason: string) => void;
}

interface Waiting {
  requestId: string;
  commandType: string;
  answerType: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (answer: ViewerEvent) => void;
  reject: (error: Error) => void;
}

export const createPendingAnswers = (): PendingAnswers => {
  const waiting = new Map<string, Waiting>();

  const awaitAnswer = (
    requestId: string,
    commandType: string,
    answerType: string,
  ): Promise<ViewerEvent> =>
    new Promise<ViewerEvent>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(requestId);
        reject(
          new Error(
            `${commandType} ${requestId} was not answered with ${answerType} within ${String(EXCHANGE_TIMEOUT_MS)} ms`,
          ),
        );
      }, EXCHANGE_TIMEOUT_MS);

      waiting.set(requestId, { requestId, commandType, answerType, timer, resolve, reject });
    });

  const settle = (event: ViewerEvent): boolean => {
    const causedBy = 'causedBy' in event ? event.causedBy : undefined;

    if (causedBy === undefined) {
      return false;
    }

    const pending = waiting.get(causedBy);

    if (pending?.answerType !== event.type) {
      return false;
    }

    clearTimeout(pending.timer);
    waiting.delete(causedBy);
    pending.resolve(event);
    return true;
  };

  const rejectAll = (reason: string): void => {
    for (const { requestId, commandType, timer, reject } of waiting.values()) {
      clearTimeout(timer);
      reject(new Error(`${commandType} ${requestId}: ${reason}`));
    }
    waiting.clear();
  };

  return { awaitAnswer, settle, rejectAll };
};
