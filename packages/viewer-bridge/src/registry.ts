import type { HostCommand } from '@bdiadiun/scoring-contract';

import { LOG_PREFIX } from './config.js';
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
  const unknownTypesLogged = new Set<string>();

  return {
    register: <TType extends CommandType>(type: TType, handler: CommandHandler<TType>): void => {
      if (handlers.has(type)) {
        console.warn(`${LOG_PREFIX} handler for ${type} replaced by a later registration`);
      }

      handlers.set(type, handler);
    },

    dispatch: (command: HostCommand): void => {
      const handler = handlers.get(command.type) as CommandHandler<CommandType> | undefined;

      if (!handler) {
        // A newer host may send a command this viewer does not know yet; logged once per type so
        // it stays diagnosable without flooding the console.
        if (!unknownTypesLogged.has(command.type)) {
          unknownTypesLogged.add(command.type);
          console.warn(`${LOG_PREFIX} no handler registered for host command ${command.type}`);
        }
        return;
      }

      handler(command);
    },
  };
};
