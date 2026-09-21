import type { HostCommand, ToolName, ViewerEvent } from '@bdiadiun/scoring-contract';
import type { Row } from '../form/rows';

export interface UseScoringFormOptions {
  send: (command: HostCommand) => void;
  lastEvent: ViewerEvent | null;
}

export interface UseScoringFormResult {
  rows: Row[];
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
}
