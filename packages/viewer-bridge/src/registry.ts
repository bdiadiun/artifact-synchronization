import type { HostCommand } from '@bdiadiun/scoring-contract';

import type {
  CommandHandler,
  CommandHandlerEntry,
  CommandHandlers,
  CommandRegistry,
  CommandType,
  StoredHandler,
} from './registry.props.js';

// Object.entries widens the keys to string and loses the key-to-handler correlation; dispatch
// restores it by only ever calling a handler with the type it was registered under.
export const toCommandHandlerEntries = (handlers: CommandHandlers): CommandHandlerEntry[] =>
  Object.entries(handlers) as CommandHandlerEntry[];

export const createCommandRegistry = (): CommandRegistry => {
  const handlers = new Map<CommandType, StoredHandler>();

  return {
    register: <TType extends CommandType>(type: TType, handler: CommandHandler<TType>): void => {
      handlers.set(type, handler);
    },

    dispatch: (command: HostCommand): void => {
      const handler = handlers.get(command.type) as CommandHandler<CommandType> | undefined;

      // Unreachable: `isHostCommand` rejects an unknown type before dispatch and the `satisfies
      // CommandHandlers` clause guarantees a handler per type; this only narrows away `get`.
      if (!handler) {
        return;
      }

      handler(command);
    },
  };
};
