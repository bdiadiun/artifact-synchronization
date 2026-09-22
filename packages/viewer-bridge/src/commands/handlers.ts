import type {
  ActivateToolCommand,
  DeactivateToolCommand,
  FocusMeasurementCommand,
  HostCommand,
  RemoveMeasurementCommand,
} from '@bdiadiun/scoring-contract';

import {
  LOG_PREFIX,
  type ViewerChannel,
  type OhifCommandsManager,
  type OhifServices,
  type OhifToolGroupService,
} from '../ohif/surface.js';
import { createRestore } from './restore.js';

const DEFAULT_TOOL = 'WindowLevel';

export interface ScoringCommands {
  handleCommand: (command: HostCommand) => void;
  takeArmed: () => string | null;
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
  { measurementUid }: RemoveMeasurementCommand,
): void => {
  if (services.measurementService.getMeasurement(measurementUid)) {
    services.measurementService.remove(measurementUid);
  }
};

const focusMeasurement = (
  services: OhifServices,
  { measurementUid }: FocusMeasurementCommand,
): void => {
  const { measurementService, viewportGridService } = services;

  if (!measurementService.getMeasurement(measurementUid)) {
    console.debug(`${LOG_PREFIX} ${measurementUid} is unknown; nothing to focus`);
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
  let armed: string | null = null;

  const restoreDefaultTool = (): void => {
    activateTool(services.toolGroupService, commandsManager, DEFAULT_TOOL);
  };

  const takeArmed = (): string | null => {
    const taken = armed;
    armed = null;
    return taken;
  };

  const handleActivateTool = ({ rowId, toolName }: ActivateToolCommand): void => {
    armed = rowId;
    activateTool(services.toolGroupService, commandsManager, toolName);
  };

  const handleDeactivateTool = ({ rowId }: DeactivateToolCommand): void => {
    if (armed === rowId) {
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
        removeMeasurement(services, command);
        break;
      case 'FOCUS_MEASUREMENT':
        focusMeasurement(services, command);
        break;
      case 'RESTORE_MEASUREMENTS':
        restore.handleRestore(command);
        break;
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
