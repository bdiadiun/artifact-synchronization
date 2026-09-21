// Which viewer event answers which host command (A-21). The `satisfies` clause is the
// exhaustiveness check: a command added to the table without an answer type fails the build.

import type { AnswerTypeByCommand } from './answers.props';

export const ANSWER_TYPE_BY_COMMAND = {
  REMOVE_MEASUREMENT: 'MEASUREMENT_REMOVED',
  RESTORE_MEASUREMENTS: 'MEASUREMENTS_RESTORED',
} as const satisfies AnswerTypeByCommand;
