import type { ActivateToolCommand, DeactivateToolCommand } from '@bdiadiun/scoring-contract';
import type { OhifCommandsManager, OhifServicesManager } from './ohif.props.js';
import type { DisarmReason } from './commands.js';

export interface ArmedState {
  rowId: string;
  requestId: string;
  previousTool: string | null;
}

export interface ToolCommandsDeps {
  servicesManager: OhifServicesManager;
  commandsManager: OhifCommandsManager;
}

export interface ToolCommands {
  handleActivateTool: (command: ActivateToolCommand) => void;
  handleDeactivateTool: (command: DeactivateToolCommand) => void;
  getArmed: () => ArmedState | null;
  disarm: (reason: DisarmReason, detail?: string) => void;
}

export interface ToolControl {
  readActiveTool: () => string | null;
  activateTool: (toolName: string) => boolean;
}

export interface ArmedRow {
  get: () => ArmedState | null;
  arm: (state: ArmedState) => void;
  disarm: (reason: DisarmReason, detail?: string) => void;
}
