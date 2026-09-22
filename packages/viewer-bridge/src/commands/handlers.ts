import type {
  ActivateToolCommand,
  DeactivateToolCommand,
  FocusMeasurementCommand,
  HostCommand,
  RemoveMeasurementCommand,
} from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import {
  LOG_PREFIX,
  type OhifCommandsManager,
  type OhifServices,
  type OhifToolGroupService,
} from '../ohif/surface.js';
import { createRestore } from './restore.js';

const DEFAULT_TOOL = 'WindowLevel';

export interface ArmedRow {
  rowId: string;
  requestId: string;
}

export interface ScoringCommands {
  handleCommand: (command: HostCommand) => void;
  takeArmed: () => ArmedRow | null;
  restoreDefaultTool: () => void;
  dispose: () => void;
}

const activateTool = (
  toolGroupService: OhifToolGroupService,
  commandsManager: OhifCommandsManager,
  toolName: string,
): void => {
  const toolGroup = toolGroupService.getToolGroup();

  if (!toolGroup) {
    console.error(
      `${LOG_PREFIX} no tool group for the active viewport; cannot activate ${toolName}`,
    );
    return;
  }

  if (!toolGroup.hasTool(toolName)) {
    console.error(`${LOG_PREFIX} tool ${toolName} is not registered in tool group ${toolGroup.id}`);
    return;
  }

  commandsManager.runCommand('setToolActive', { toolName });
};

const removeMeasurement = (
  services: OhifServices,
  channel: ViewerChannel,
  { measurementUid, requestId }: RemoveMeasurementCommand,
): void => {
  if (services.measurementService.getMeasurement(measurementUid)) {
    services.measurementService.remove(measurementUid);
  }

  channel.send({ type: 'MEASUREMENT_REMOVED', measurementUid, causedBy: requestId });
};

const focusMeasurement = (
  services: OhifServices,
  { measurementUid, rowId }: FocusMeasurementCommand,
): void => {
  const { measurementService, viewportGridService } = services;

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
  const restore = createRestore(services, channel);
  let armed: ArmedRow | null = null;

  const restoreDefaultTool = (): void => {
    activateTool(services.toolGroupService, commandsManager, DEFAULT_TOOL);
  };

  const takeArmed = (): ArmedRow | null => {
    const taken = armed;
    armed = null;
    return taken;
  };

  const handleActivateTool = ({ rowId, requestId, toolName }: ActivateToolCommand): void => {
    armed = { rowId, requestId };
    activateTool(services.toolGroupService, commandsManager, toolName);
  };

  const handleDeactivateTool = ({ rowId }: DeactivateToolCommand): void => {
    if (armed?.rowId === rowId) {
      armed = null;
      restoreDefaultTool();
    }
  };

  const handleCommand = (command: HostCommand): void => {
    switch (command.type) {
      case 'ACTIVATE_TOOL':
        handleActivateTool(command);
        break;
      case 'DEACTIVATE_TOOL':
        handleDeactivateTool(command);
        break;
      case 'REMOVE_MEASUREMENT':
        removeMeasurement(services, channel, command);
        break;
      case 'FOCUS_MEASUREMENT':
        focusMeasurement(services, command);
        break;
      case 'RESTORE_MEASUREMENTS':
        restore.handleRestore(command);
        break;
      default: {
        const exhaustive: never = command;
        return exhaustive;
      }
    }
  };

  const dispose = (): void => {
    if (armed !== null) {
      restoreDefaultTool();
    }
    restore.dispose();
  };

  return { handleCommand, takeArmed, restoreDefaultTool, dispose };
};
