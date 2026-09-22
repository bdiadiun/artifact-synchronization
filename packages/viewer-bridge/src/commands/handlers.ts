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
} from '../ohif/surface.js';
import { createRestore } from './restore.js';

const DEFAULT_TOOL = 'WindowLevel';

type ActivateTool = (toolName: string) => void;

export interface ScoringCommands {
  handlers: MessageHandlers<HostCommand>;
  takePendingRemoval: (measurementUid: string) => RemoveMeasurementCommand | undefined;
  restoreDefaultTool: () => void;
  dispose: () => void;
}

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

    if (!measurementService.getMeasurement(measurementUid)) {
      console.debug(`${LOG_PREFIX} ${measurementUid} (row ${rowId}) is already gone`);
      channel.reply(command, { measurementUid });
      return;
    }

    pendingRemovals.set(measurementUid, command);

    try {
      measurementService.remove(measurementUid);
    } finally {
      pendingRemovals.delete(measurementUid);
    }
  };

const createFocusHandler =
  (services: OhifServices) =>
  ({ measurementUid, rowId }: FocusMeasurementCommand): void => {
    const { measurementService, viewportGridService } = services;

    if (!measurementService || !viewportGridService) {
      console.warn(`${LOG_PREFIX} measurement/viewportGrid service unavailable; nothing focused`);
      return;
    }

    if (!measurementService.getMeasurement(measurementUid)) {
      console.debug(`${LOG_PREFIX} ${measurementUid} (row ${rowId}) is unknown; nothing to focus`);
      return;
    }

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

  const handleDeactivateTool = (): void => {
    if (channel.getArmed() === null) {
      restoreDefaultTool();
    }
  };

  const handlers = {
    ACTIVATE_TOOL: handleActivateTool,
    DEACTIVATE_TOOL: handleDeactivateTool,
    REMOVE_MEASUREMENT: handleRemove,
    FOCUS_MEASUREMENT: handleFocus,
    RESTORE_MEASUREMENTS: restore.handleRestore,
  } satisfies MessageHandlers<HostCommand>;

  const takePendingRemoval = (measurementUid: string): RemoveMeasurementCommand | undefined => {
    const command = pendingRemovals.get(measurementUid);
    pendingRemovals.delete(measurementUid);
    return command;
  };

  const dispose = (): void => {
    if (channel.getArmed() !== null) {
      restoreDefaultTool();
    }
    restore.dispose();
  };

  return { handlers, takePendingRemoval, restoreDefaultTool, dispose };
};
