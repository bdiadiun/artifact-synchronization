// Type-only import of the table, so the pairs are written once and these follow it.
import type { ANSWER_TYPE_BY_COMMAND } from './answers';

// The commands an answer exists for; every other command is one-way.
export type AnsweredCommandType = keyof typeof ANSWER_TYPE_BY_COMMAND;

export type AnswerTypeOf<TType extends AnsweredCommandType> =
  (typeof ANSWER_TYPE_BY_COMMAND)[TType];
