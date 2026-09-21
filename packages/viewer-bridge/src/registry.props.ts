import type { HostCommand } from '@bdiadiun/scoring-contract';

export type CommandType = HostCommand['type'];

export type CommandOfType<TType extends CommandType> = Extract<HostCommand, { type: TType }>;

export type CommandHandler<TType extends CommandType> = (command: CommandOfType<TType>) => void;

// A handler per command type; used with `satisfies` so a new type in the contract fails the
// type check until a handler exists for it.
export type CommandHandlers = { [TType in CommandType]: CommandHandler<TType> };

export type CommandHandlerEntry = readonly [CommandType, CommandHandler<CommandType>];

export interface CommandRegistry {
  register: <TType extends CommandType>(type: TType, handler: CommandHandler<TType>) => void;
  dispatch: (command: HostCommand) => void;
}

// A stored handler accepts only the command type it was registered under; `never` keeps the
// store assignable from every handler and forces dispatch to state that guarantee once.
export type StoredHandler = (command: never) => void;
