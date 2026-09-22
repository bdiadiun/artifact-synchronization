import type { HostCommand } from './hostCommands.props';
import type { ViewerEvent } from './viewerEvents.props';

export const ANSWER_TYPE_BY_COMMAND = {
  REMOVE_MEASUREMENT: 'MEASUREMENT_REMOVED',
  RESTORE_MEASUREMENTS: 'MEASUREMENTS_RESTORED',
} as const satisfies Partial<Record<HostCommand['type'], ViewerEvent['type']>>;

export type AnsweredCommandType = keyof typeof ANSWER_TYPE_BY_COMMAND;

export type AnswerTypeOf<TType extends AnsweredCommandType> =
  (typeof ANSWER_TYPE_BY_COMMAND)[TType];
