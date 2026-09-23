import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { Bridge } from '../bridge.js';
import type { Ohif } from '../ohif/facade.js';
import { LOG_PREFIX } from '../ohif/surface.js';
import { holdsViewportData, runRestore } from './restore.js';

export const DEFAULT_TOOL = 'WindowLevel';

export const activateTool = (ohif: Ohif, toolName: string): void => {
  const toolGroup = ohif.services.toolGroupService.getToolGroup();

  if (!toolGroup) {
    console.error(`${LOG_PREFIX} no tool group for the active viewport; cannot activate ${toolName}`);
    return;
  }

  if (!toolGroup.hasTool(toolName)) {
    console.error(`${LOG_PREFIX} tool ${toolName} is not registered in tool group ${toolGroup.id}`);
    return;
  }

  ohif.commandsManager.runCommand('setToolActive', { toolName });
};

const focusMeasurement = (ohif: Ohif, measurementUid: string): void => {
  const { measurementService, viewportGridService } = ohif.services;

  if (!measurementService.getMeasurement(measurementUid)) {
    console.debug(`${LOG_PREFIX} ${measurementUid} is unknown; nothing to focus`);
    return;
  }

  measurementService.jumpToMeasurement(viewportGridService.getActiveViewportId(), measurementUid);
};

export const handleCommand = (ohif: Ohif, bridge: Bridge, command: HostCommand): void => {
  switch (command.type) {
    case 'ACTIVATE_TOOL':
      bridge.armedRowId = command.rowId;
      activateTool(ohif, command.toolName);
      break;
    case 'DEACTIVATE_TOOL':
      if (bridge.armedRowId === command.rowId) {
        bridge.armedRowId = null;
        activateTool(ohif, DEFAULT_TOOL);
      }
      break;
    case 'REMOVE_MEASUREMENT':
      if (ohif.services.measurementService.getMeasurement(command.measurementUid)) {
        ohif.services.measurementService.remove(command.measurementUid);
      }
      break;
    case 'FOCUS_MEASUREMENT':
      focusMeasurement(ohif, command.measurementUid);
      break;
    case 'RESTORE_MEASUREMENTS':
      if (holdsViewportData(ohif.services)) {
        runRestore(ohif.services, bridge.channel, command);
      } else {
        bridge.pendingRestore = command;
      }
      break;
  }
};
