import { createDisposerSet, type Disposable } from '@bdiadiun/scoring-channel';
import { LOG_PREFIX } from './config.js';
import { createToolCommands, DisarmReason } from './commands.js';
import { createRemovalCommands } from './removals.js';
import { createFocusCommands } from './focus.js';
import { createRestoreCommands } from './restore.js';
import { createHandshake } from './handshake.js';
import { createCommandListener, createPostToHost } from './messaging.js';
import { createCommandRegistry, toCommandHandlerEntries } from './registry.js';
import type { CommandHandlers } from './registry.props.js';
import { createMeasurementStream } from './measurementStream.js';
import { createReportedMeasurements } from './reportedMeasurements.js';
import type { OhifCommandsManager, OhifServicesManager } from './ohif.props.js';

export interface BridgeDeps {
  servicesManager: OhifServicesManager;
  commandsManager: OhifCommandsManager;
  hostOrigin: string;
}

export type Bridge = Disposable;

export const createBridge = ({
  servicesManager,
  commandsManager,
  hostOrigin,
}: BridgeDeps): Bridge => {
  const postToHost = createPostToHost(hostOrigin);
  const reported = createReportedMeasurements({ post: postToHost });

  const removals = createRemovalCommands({
    servicesManager,
    post: postToHost,
    forget: reported.forget,
  });
  const focus = createFocusCommands({ servicesManager });
  const restore = createRestoreCommands({ servicesManager, reported, post: postToHost });

  const toolCommands = createToolCommands({ servicesManager, commandsManager });

  // The satisfies clause is the exhaustiveness check: a new command type in the contract fails
  // the type check here until it has a handler.
  const commandHandlers = {
    ACTIVATE_TOOL: toolCommands.handleActivateTool,
    DEACTIVATE_TOOL: toolCommands.handleDeactivateTool,
    // Removing or focusing an existing annotation leaves the armed row waiting for its drawing.
    REMOVE_MEASUREMENT: removals.handleRemove,
    FOCUS_MEASUREMENT: focus.handleFocus,
    RESTORE_MEASUREMENTS: restore.handleRestore,
  } satisfies CommandHandlers;

  const registry = createCommandRegistry();

  for (const [type, handler] of toCommandHandlerEntries(commandHandlers)) {
    registry.register(type, handler);
  }

  const stream = createMeasurementStream({
    servicesManager,
    post: postToHost,
    reported,
    getArmed: toolCommands.getArmed,
    disarm: toolCommands.disarm,
    takeCause: removals.takeCause,
  });

  const listener = createCommandListener({ hostOrigin, onCommand: registry.dispatch });
  const handshake = createHandshake({ servicesManager, hostOrigin, post: postToHost });

  const disposers = createDisposerSet({ logPrefix: LOG_PREFIX });

  // The doctor's tool is restored before the subscriptions go away, and every subscription is
  // released in the order it was taken out in.
  disposers.add(() => {
    toolCommands.disarm(DisarmReason.BridgeDispose);
  });
  disposers.add(handshake.dispose);
  disposers.add(listener.dispose);
  disposers.add(stream.dispose);
  disposers.add(restore.dispose);
  disposers.add(reported.dispose);

  return { dispose: disposers.dispose };
};
