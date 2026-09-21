import type { HostCommand } from './hostCommands.props';
import type { ViewerEvent } from './viewerEvents.props';

// Both halves of the table are checked against the contract: a key that is no host command or an
// answer that is no viewer event fails here instead of at the call site that awaits it.
type AnswerTable<TTable extends Partial<Record<HostCommand['type'], ViewerEvent['type']>>> = TTable;

export type AnswerTypeByCommand = AnswerTable<{
  REMOVE_MEASUREMENT: 'MEASUREMENT_REMOVED';
  RESTORE_MEASUREMENTS: 'MEASUREMENTS_RESTORED';
}>;

// The commands an answer exists for; every other command is one-way.
export type AnsweredCommandType = keyof AnswerTypeByCommand;

export type AnswerTypeOf<TType extends AnsweredCommandType> = AnswerTypeByCommand[TType];
