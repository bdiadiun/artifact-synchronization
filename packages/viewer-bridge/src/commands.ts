import type {
  ActivateToolCommand,
  FocusMeasurementCommand,
  HostCommand,
  RemoveMeasurementCommand,
} from '@bdiadiun/scoring-contract';
import type { MessageHandlers, ViewerChannel } from '@bdiadiun/scoring-channel';

import {
  LOG_PREFIX,
  type OhifCommandsManager,
  type OhifMeasurementService,
  type OhifServices,
  type OhifToolGroupService,
} from './ohif.js';
import { createRestore } from './restore.js';

// A-23: a released row leaves the doctor with OHIF's default primary-mouse tool
// (modes/basic/src/initToolGroups.ts:21-24) rather than with whatever was active before we armed.
const DEFAULT_TOOL = 'WindowLevel';

type ActivateTool = (toolName: string) => void;

export interface ScoringCommands {
  handlers: MessageHandlers<HostCommand>;
  // The REMOVE command the next removal of this uid answers, taken once (A-10).
  takePendingRemoval: (measurementUid: string) => RemoveMeasurementCommand | undefined;
  restoreDefaultTool: () => void;
  dispose: () => void;
}

// Not setToolActiveToolbar, which arms every tool group (commandsModule.ts:1025-1068). Both
// preconditions are checked here because setToolActive fails silently without them.
const createToolActivation =
  (
    toolGroupService: OhifToolGroupService | undefined,
    commandsManager: OhifCommandsManager,
  ): ActivateTool =>
  (toolName) => {
    const toolGroup = toolGroupService?.getToolGroup();

    if (!toolGroup) {
      console.error(
        `${LOG_PREFIX} no tool group for the active viewport; cannot activate ${toolName}`,
      );
      return;
    }

    if (!toolGroup.hasTool(toolName)) {
      console.error(
        `${LOG_PREFIX} tool ${toolName} is not registered in tool group ${toolGroup.id}`,
      );
      return;
    }

    commandsManager.runCommand('setToolActive', { toolName });
  };

const createRemoveHandler =
  (
    measurementService: OhifMeasurementService | undefined,
    channel: ViewerChannel,
    pendingRemovals: Map<string, RemoveMeasurementCommand>,
  ) =>
  (command: RemoveMeasurementCommand): void => {
    const { measurementUid, rowId } = command;

    if (!measurementService) {
      console.warn(`${LOG_PREFIX} measurementService unavailable; ${measurementUid} not removed`);
      return;
    }

    // A-10 idempotency: our own "no measurement -> no event" guarantee, not remove()'s silent
    // return (MeasurementService.ts:675-680). Answered anyway, so the host's exchange settles at
    // once instead of waiting for its timeout.
    if (!measurementService.getMeasurement(measurementUid)) {
      console.debug(`${LOG_PREFIX} ${measurementUid} (row ${rowId}) is already gone`);
      channel.reply(command, { measurementUid });
      return;
    }

    // Parked before the call: remove() broadcasts synchronously (MeasurementService.ts:674-689)
    // and the measurement subscription is what answers this command.
    pendingRemovals.set(measurementUid, command);

    try {
      // The removeMeasurement command only wraps this call (commandsModule.ts:746-751);
      // cornerstone erases the drawing on MEASUREMENT_REMOVED (initMeasurementService.ts:501-522).
      measurementService.remove(measurementUid);
    } finally {
      // Also clears an expectation remove() left unanswered, which would otherwise stamp a stale
      // cause on a later deletion of the same uid.
      pendingRemovals.delete(measurementUid);
    }
  };

// S-5.3: posts nothing back and only moves the viewport, so it cannot start an echo loop (Q-4).
const createFocusHandler =
  (services: OhifServices) =>
  ({ measurementUid, rowId }: FocusMeasurementCommand): void => {
    const { measurementService, viewportGridService } = services;

    if (!measurementService || !viewportGridService) {
      console.warn(`${LOG_PREFIX} measurement/viewportGrid service unavailable; nothing focused`);
      return;
    }

    // A-10: an unknown uid is an ordinary race (row removed, event in flight), not the programming
    // error jumpToMeasurement would log.warn about (MeasurementService.ts:741-745).
    if (!measurementService.getMeasurement(measurementUid)) {
      console.debug(`${LOG_PREFIX} ${measurementUid} (row ${rowId}) is unknown; nothing to focus`);
      return;
    }

    // The panel's command makes this same call (commandsModule.ts:739-744); cornerstone's
    // JUMP_TO_MEASUREMENT handler selects the annotation and moves the camera (:208-241).
    measurementService.jumpToMeasurement(viewportGridService.getActiveViewportId(), measurementUid);
  };

export const createCommands = (
  services: OhifServices,
  commandsManager: OhifCommandsManager,
  channel: ViewerChannel,
): ScoringCommands => {
  const activateTool = createToolActivation(services.toolGroupService, commandsManager);
  const pendingRemovals = new Map<string, RemoveMeasurementCommand>();
  const restore = createRestore(services, channel);

  const handleRemove = createRemoveHandler(services.measurementService, channel, pendingRemovals);
  const handleFocus = createFocusHandler(services);

  const restoreDefaultTool = (): void => {
    activateTool(DEFAULT_TOOL);
  };

  const handleActivateTool = ({ toolName }: ActivateToolCommand): void => {
    activateTool(toolName);
  };

  // The channel has already cleared the row this command names, so anything still armed means the
  // host deactivated a different one and the doctor keeps the tool (A-10).
  const handleDeactivateTool = (): void => {
    if (channel.getArmed() === null) {
      restoreDefaultTool();
    }
  };

  return {
    // The satisfies clause is the exhaustiveness check: a command added to the contract fails the
    // type check here until it has a handler.
    handlers: {
      ACTIVATE_TOOL: handleActivateTool,
      DEACTIVATE_TOOL: handleDeactivateTool,
      // Removing or focusing an existing annotation leaves the armed row waiting for its drawing.
      REMOVE_MEASUREMENT: handleRemove,
      FOCUS_MEASUREMENT: handleFocus,
      RESTORE_MEASUREMENTS: restore.handleRestore,
    } satisfies MessageHandlers<HostCommand>,

    takePendingRemoval: (measurementUid: string): RemoveMeasurementCommand | undefined => {
      const command = pendingRemovals.get(measurementUid);
      pendingRemovals.delete(measurementUid);
      return command;
    },

    restoreDefaultTool,

    dispose: (): void => {
      // Q-5: the viewer is never left with a tool the form armed and nobody disarmed.
      if (channel.getArmed() !== null) {
        restoreDefaultTool();
      }
      restore.dispose();
    },
  };
};
