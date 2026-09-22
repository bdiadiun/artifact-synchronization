import {
  createDisposerSet,
  createViewerChannel,
  type Disposable,
  type MessageHandlers,
} from '@bdiadiun/scoring-channel';
import type { HostCommand } from '@bdiadiun/scoring-contract';
import { LOG_PREFIX } from './config.js';
import { createToolCommands, DisarmReason } from './commands.js';
import { createRemovalCommands } from './removals.js';
import { createFocusCommands } from './focus.js';
import { createRestoreCommands } from './restore.js';
import { createHandshake } from './handshake.js';
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
  const channel = createViewerChannel({ hostOrigin });
  const send = channel.send;

  const reported = createReportedMeasurements({ send });

  const removals = createRemovalCommands({ servicesManager, send, reported });
  const focus = createFocusCommands({ servicesManager });
  const restore = createRestoreCommands({ servicesManager, reported, send });

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
  } satisfies MessageHandlers<HostCommand>;

  channel.onEach(commandHandlers);

  const stream = createMeasurementStream({ servicesManager, reported, armed: toolCommands });

  const handshake = createHandshake({ servicesManager, hostOrigin, send });

  const disposers = createDisposerSet({ logPrefix: LOG_PREFIX });

  // The doctor's tool is restored before the subscriptions go away, and every subscription is
  // released in the order it was taken out in. The channel's own handlers go with it.
  disposers.add(() => {
    toolCommands.disarm(DisarmReason.BridgeDispose);
  });
  disposers.add(handshake.dispose);
  disposers.add(channel.dispose);
  disposers.add(stream.dispose);
  disposers.add(restore.dispose);
  disposers.add(reported.dispose);

  return { dispose: disposers.dispose };
};
